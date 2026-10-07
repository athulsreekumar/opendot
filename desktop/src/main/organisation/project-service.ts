// Projects: state machine, scheduler, task protocol and review loop (docs/spec/15-organisation.md §5 to §9).
// All outside effects come in through `ProjectDeps`, so the scheduler and the review loop run in unit tests without Electron.
import { OpenDotError } from "../../shared/errors";
import {
	blockedByFailure,
	ORG_LIMITS,
	type OrgCreateProjectInput,
	type OrgLogEntry,
	type OrgProject,
	type OrgProjectSummary,
	type OrgReview,
	type OrgState,
	type OrgTask,
	type OrgTaskInput,
	type OrgUpdateView,
	parseReviewReply,
	parseTaskReply,
	projectAttention,
	readyTaskIds,
	summarizeProject,
	validatePlan,
} from "../../shared/organisation";
import type { Dot, DotId } from "../../shared/types";
import { log } from "../log";
import {
	collectDeliverables,
	readTextDeliverables,
	resolveWorkspaceFile,
	type Snapshot,
	snapshotTaskFiles,
} from "./deliverables";
import {
	activeProjectsLine,
	answerPrompt,
	fallbackSummary,
	plannerPrompt,
	reportPrompt,
	reviewPrompt,
	revisionPrompt,
	type TeamLine,
	taskPrompt,
} from "./project-prompts";
import { newProjectId, type ProjectRepo } from "./project-store";

export interface RunTaskOpts {
	signal: AbortSignal;
	/** How long the Dot may take before the run is stopped (ORG_LIMITS.taskTimeoutMin). */
	timeoutMs: number;
}
export type RunTaskResult = { ok: true; reply: string } | { ok: false; reason: string };

export interface HiddenTurnRequest {
	kind: "plan" | "report";
	projectId: string;
	prompt: string;
}
export interface HiddenTurnResult {
	text: string;
	error?: string;
}

export interface ProjectDeps {
	repo: ProjectRepo;
	/** The team file (read fresh each time; it is written by the team service). */
	org: () => Promise<OrgState>;
	dot: (id: DotId) => Promise<Dot | undefined>;
	superDot: () => Promise<Dot>;
	/** Sends a message from SuperDot to a Dot through the LinkBus (Dot Links rules, approvals, budgets, PII, audit). */
	runTask: (fromSuper: Dot, toDotId: DotId, prompt: string, opts: RunTaskOpts) => Promise<RunTaskResult>;
	/** A hidden SuperDot turn (planner, final report). Resolves when the turn has ended. */
	runHiddenSuperTurn: (req: HiddenTurnRequest) => Promise<HiddenTurnResult>;
	/** Cost so far of a Dot in USD (a rising counter; the service uses differences). */
	costOf: (dotId: DotId) => number;
	now: () => Date;
	emit: (p: OrgProject) => void;
	notify: (n: { title: string; body: string; hash: string }) => void;
	/** Posts an `opendot.org-update` card to SuperDot's chat. */
	postUpdate: (u: OrgUpdateView) => Promise<void>;
	newId?: () => string;
	skillNames?: (skillIds: string[]) => Promise<string[]>;
	reviewedBy?: () => Record<string, string[]>;
	/** Minimum gap between `org:project` events of one project (default 100). 0 sends every change. */
	throttleMs?: number;
	/** Wait after a turn so its cost has been recorded (default 0). */
	settleMs?: number;
	defaultConcurrency?: number;
}

const SKIP_PREFIX = "Skipped because";
const DEFAULT_REVIEWED_BY: Record<string, string[]> = {
	engineering: ["security"],
	product: ["design"],
	design: ["product"],
	data: ["engineering"],
	it: ["security"],
	hr: ["legal"],
	finance: ["legal"],
	marketing: ["legal"],
	sales: ["legal"],
};

/** A task as SuperDot writes it in `propose_plan`: Dots by name. */
export interface NamedTaskInput {
	id: string;
	title: string;
	brief: string;
	assignee: string;
	dependsOn?: string[];
	reviewer?: string;
}

const key = (pid: string, tid: string) => `${pid}:${tid}`;
const clone = <T>(v: T): T => structuredClone(v);
const isDoneOrSkipped = (t: OrgTask) => t.status === "done" || t.status === "skipped";
const allFinished = (p: OrgProject) => p.tasks.length > 0 && p.tasks.every(isDoneOrSkipped);
const lastReview = (t: OrgTask): OrgReview | undefined => t.reviews[t.reviews.length - 1];
const prettySkill = (id: string) =>
	id
		.replace(/^builtin:/, "")
		.replace(/-/g, " ")
		.replace(/^./, (c) => c.toUpperCase());

function bad(message: string, code = "INVALID_STATE"): never {
	throw new OpenDotError(code, message);
}

export class ProjectService {
	private projects = new Map<string, OrgProject>();
	private loaded: Promise<void> | undefined;
	private stopped = false;
	private inflight = new Map<string, AbortController>();
	private reviewing = new Set<string>();
	private snapshots = new Map<string, Snapshot>();
	private finalizing = new Set<string>();
	private announced = new Set<string>();
	private planBackup = new Map<string, OrgTask[]>();
	private names = new Map<DotId, string>();
	private dirty = new Set<string>();
	private saves = new Set<Promise<unknown>>();
	private lastEmit = new Map<string, number>();
	private emitTimers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(private readonly deps: ProjectDeps) {}

	// ───────────────────────── lifecycle ─────────────────────────

	/** Loads projects and applies the restart rule (spec §6): nothing runs without the user. */
	start(): Promise<void> {
		this.loaded ??= this.load();
		return this.loaded;
	}

	/** Stops timers and aborts running tasks without recording them as failed (the restart rule handles them next time). */
	stop(): void {
		this.stopped = true;
		for (const c of this.inflight.values()) c.abort();
		for (const t of this.emitTimers.values()) clearTimeout(t);
		this.emitTimers.clear();
	}

	/** Resolves when every pending write has finished (shutdown and tests). */
	async flush(): Promise<void> {
		await Promise.resolve();
		while (this.saves.size) await Promise.allSettled([...this.saves]);
	}

	private async load(): Promise<void> {
		for (const p of await this.deps.repo.list()) this.projects.set(p.id, p);
		for (const p of this.projects.values()) {
			if (p.status === "running") {
				p.status = "paused";
				p.statusNote = "OpenDot was closed. Resume when you're ready.";
				for (const t of p.tasks) if (t.status === "running") t.status = "pending";
				this.addLog(p, "info", "OpenDot was closed, so the project was paused.");
				this.commit(p);
			} else if (p.status === "planning") {
				p.status = "awaiting-approval";
				p.statusNote = "Planning was interrupted. Ask SuperDot to plan again, or add the tasks yourself.";
				this.addLog(p, "error", "Planning was interrupted.");
				this.commit(p);
			}
		}
		await this.flush();
	}

	// ───────────────────────── queries ─────────────────────────

	async list(): Promise<OrgProjectSummary[]> {
		await this.start();
		return [...this.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarizeProject);
	}

	async get(id: string): Promise<OrgProject> {
		return clone(await this.need(id));
	}

	private async need(id: string): Promise<OrgProject> {
		await this.start();
		const p = this.projects.get(id);
		if (!p) throw new OpenDotError("NOT_FOUND", "That project no longer exists.");
		return p;
	}

	private task(p: OrgProject, taskId: string): OrgTask {
		const t = p.tasks.find((x) => x.id === taskId);
		if (!t) throw new OpenDotError("NOT_FOUND", "That task no longer exists.");
		return t;
	}

	/** Lines for the daily briefing prompt (spec §8). */
	async activeProjectsLine(): Promise<string | undefined> {
		await this.start();
		return activeProjectsLine(
			[...this.projects.values()]
				.filter((p) => p.status === "running" || p.status === "paused" || p.status === "awaiting-approval")
				.map((p) => ({
					title: p.title,
					done: p.tasks.filter(isDoneOrSkipped).length,
					total: p.tasks.length,
					waiting: projectAttention(p),
				})),
		);
	}

	// ───────────────────────── team ─────────────────────────

	private async team(): Promise<Array<{ dot: Dot; domain: string; skillIds: string[] }>> {
		const org = await this.deps.org();
		const out: Array<{ dot: Dot; domain: string; skillIds: string[] }> = [];
		for (const m of org.members) {
			const dot = await this.deps.dot(m.dotId);
			if (!dot || dot.archived) continue;
			this.names.set(dot.id, dot.name);
			out.push({ dot, domain: m.domain, skillIds: m.skillIds });
		}
		return out;
	}

	/** Text for SuperDot's `org_team` tool. */
	async teamDirectory(): Promise<string> {
		const org = await this.deps.org();
		if (!org.created) return "No organisation yet. Ask the user to set up a team in Organisation.";
		const team = await this.team();
		const lines = await Promise.all(
			team.map(async (m) => {
				const skills = this.deps.skillNames ? await this.deps.skillNames(m.skillIds) : m.skillIds.map(prettySkill);
				return `- ${m.dot.name} (${m.domain})${skills.length ? `, skills: ${skills.join(", ")}` : ""}${m.dot.tagline ? `. ${m.dot.tagline}` : ""}`;
			}),
		);
		return [
			`Organisation: ${org.name || "My team"}`,
			"Team:",
			...lines,
			"- human: the user, for anything only they can do or decide.",
		].join("\n");
	}

	private async teamLines(): Promise<TeamLine[]> {
		const team = await this.team();
		return Promise.all(
			team.map(async (m) => ({
				name: m.dot.name,
				domain: m.domain,
				skills: this.deps.skillNames ? await this.deps.skillNames(m.skillIds) : m.skillIds.map(prettySkill),
				about: m.dot.tagline,
			})),
		);
	}

	private nameOf(id: string): string {
		return id === "human" ? "you" : (this.names.get(id as DotId) ?? "A Dot");
	}

	private async warmNames(p: OrgProject): Promise<void> {
		const ids = new Set<DotId>();
		for (const t of p.tasks) {
			if (t.assignee !== "human") ids.add(t.assignee);
			if (t.reviewer && t.reviewer !== "human") ids.add(t.reviewer);
		}
		for (const id of ids) {
			if (this.names.has(id)) continue;
			const d = await this.deps.dot(id);
			if (d) this.names.set(id, d.name);
		}
	}

	// ───────────────────────── create and plan ─────────────────────────

	async create(input: OrgCreateProjectInput): Promise<OrgProject> {
		await this.start();
		const title = input.title.trim().slice(0, ORG_LIMITS.projectTitleMax);
		const brief = input.brief.trim().slice(0, ORG_LIMITS.projectBriefMax);
		if (!title) bad("Give the project a title.", "INVALID");
		if (!brief) bad("Describe what the project should achieve.", "INVALID");
		const org = await this.deps.org();
		if (!org.created || (await this.team()).length === 0)
			bad("Set up your team in Organisation first.", "NOT_CONFIGURED");
		const now = this.deps.now().toISOString();
		const p: OrgProject = {
			id: (this.deps.newId ?? newProjectId)(),
			title,
			brief,
			status: "planning",
			createdAt: now,
			updatedAt: now,
			tasks: [],
			concurrency: this.deps.defaultConcurrency ?? ORG_LIMITS.defaultConcurrency,
			maxRevisions: ORG_LIMITS.defaultMaxRevisions,
			...(input.budgetUsd && input.budgetUsd > 0 ? { budgetUsd: input.budgetUsd } : {}),
			spentUsd: 0,
			log: [],
		};
		this.addLog(p, "info", "Project created. SuperDot is planning.");
		this.projects.set(p.id, p);
		this.commit(p);
		void this.plan(p.id);
		return clone(p);
	}

	/** Runs the planner turn. Resolves when the turn has ended, with or without a plan. */
	async plan(id: string, feedback?: string): Promise<void> {
		const p = this.projects.get(id);
		if (p?.status !== "planning") return;
		try {
			const prompt = plannerPrompt(
				p,
				await this.teamLines(),
				this.deps.reviewedBy?.() ?? DEFAULT_REVIEWED_BY,
				feedback,
			);
			const r = await this.deps.runHiddenSuperTurn({ kind: "plan", projectId: id, prompt });
			const cur = this.projects.get(id);
			if (cur?.status !== "planning") return; // propose_plan arrived, or the project was cancelled
			this.planFailed(cur, r.error);
		} catch (e) {
			const cur = this.projects.get(id);
			if (cur?.status === "planning") this.planFailed(cur, e instanceof Error ? e.message : String(e));
		}
	}

	private planFailed(p: OrgProject, why?: string): void {
		p.tasks = this.planBackup.get(p.id) ?? [];
		this.planBackup.delete(p.id);
		p.status = "awaiting-approval";
		p.statusNote = "SuperDot didn't write a plan. Ask it to plan again, or add the tasks yourself.";
		this.addLog(p, "error", why ? "SuperDot's planning turn failed." : "SuperDot ended the turn without a plan.");
		this.commit(p);
	}

	async replan(id: string, feedback?: string): Promise<void> {
		const p = await this.need(id);
		if (p.status !== "awaiting-approval") bad("You can only ask for a new plan while the plan waits for approval.");
		this.planBackup.set(p.id, p.tasks);
		p.tasks = [];
		p.status = "planning";
		p.statusNote = undefined;
		this.addLog(p, "info", "A new plan was requested.");
		this.commit(p);
		void this.plan(p.id, feedback);
	}

	/** SuperDot's `propose_plan`. Names are resolved to Dot ids; problems come back as text for the model to fix. */
	async proposePlan(
		projectId: string,
		note: string,
		raw: NamedTaskInput[],
	): Promise<{ ok: true; taskCount: number } | { ok: false; problems: string[] }> {
		await this.start();
		const p = this.projects.get(projectId);
		if (!p) return { ok: false, problems: [`There is no project with id "${projectId}".`] };
		if (p.status !== "planning")
			return { ok: false, problems: ["This project is not waiting for a plan. Do not call propose_plan again."] };
		const team = await this.team();
		const problems: string[] = [];
		const resolve = (ref: string, taskId: string, role: string): DotId | "human" => {
			const r = ref.trim().replace(/^@/, "");
			if (/^(human|me|user|the user)$/i.test(r)) return "human";
			const lower = r.toLowerCase();
			const hit =
				team.find((m) => m.dot.id === r) ??
				team.find((m) => m.dot.name.toLowerCase() === lower) ??
				(team.filter((m) => m.dot.name.toLowerCase().startsWith(lower)).length === 1
					? team.find((m) => m.dot.name.toLowerCase().startsWith(lower))
					: undefined);
			if (hit) return hit.dot.id;
			problems.push(
				`Task ${taskId}: ${role} "${ref}" isn't on the team. Use one of: ${[...team.map((m) => m.dot.name), "human"].join(", ")}.`,
			);
			return "dot_unknown" as DotId;
		};
		const tasks: OrgTaskInput[] = raw.map((r) => ({
			id: String(r.id ?? "").trim(),
			title: String(r.title ?? "")
				.trim()
				.slice(0, ORG_LIMITS.titleMax),
			brief: String(r.brief ?? "")
				.trim()
				.slice(0, ORG_LIMITS.briefMax),
			assignee: resolve(String(r.assignee ?? ""), String(r.id), "assignee"),
			dependsOn: (r.dependsOn ?? []).map((d) => String(d).trim()),
			...(r.reviewer?.trim() ? { reviewer: resolve(r.reviewer, String(r.id), "reviewer") } : {}),
		}));
		const ids = new Set<DotId>(team.map((m) => m.dot.id));
		for (const pr of validatePlan(tasks, (id) => ids.has(id))) {
			if (/isn't on the team|who isn't on the team/.test(pr.message) && problems.length) continue;
			problems.push(pr.message);
		}
		if (problems.length) return { ok: false, problems };
		p.tasks = tasks.map(toTask);
		p.plannerNote = note.trim().slice(0, ORG_LIMITS.briefMax) || undefined;
		p.status = "awaiting-approval";
		p.statusNote = undefined;
		this.planBackup.delete(p.id);
		this.addLog(p, "info", `SuperDot proposed a plan with ${tasks.length} tasks.`);
		this.commit(p);
		this.tell(p, "plan-ready", `The plan for "${p.title}" is ready. Open it to review and approve.`);
		return { ok: true, taskCount: tasks.length };
	}

	async savePlan(id: string, tasks: OrgTaskInput[]): Promise<OrgProject> {
		const p = await this.need(id);
		if (p.status !== "awaiting-approval") bad("The plan can only be changed while it waits for approval.");
		const known = new Set((await this.team()).map((m) => m.dot.id));
		const problems = validatePlan(tasks, (d) => known.has(d));
		if (problems.length) bad(problems.map((x) => x.message).join(" "), "INVALID");
		p.tasks = tasks.map(toTask);
		this.addLog(p, "info", `The plan was edited (${tasks.length} tasks).`);
		this.commit(p);
		return clone(p);
	}

	async approve(id: string): Promise<void> {
		const p = await this.need(id);
		if (p.status !== "awaiting-approval") bad("This plan is not waiting for approval.");
		const known = new Set((await this.team()).map((m) => m.dot.id));
		const problems = validatePlan(
			p.tasks.map(({ id, title, brief, assignee, dependsOn, reviewer }) => ({
				id,
				title,
				brief,
				assignee,
				dependsOn,
				...(reviewer ? { reviewer } : {}),
			})),
			(d) => known.has(d),
		);
		if (problems.length) bad(`Fix the plan first. ${problems.map((x) => x.message).join(" ")}`, "INVALID");
		await this.warmNames(p);
		p.status = "running";
		p.statusNote = undefined;
		this.addLog(p, "info", "Plan approved. Work started.");
		this.commit(p);
		this.tick(p);
	}

	// ───────────────────────── pause, resume, cancel, delete ─────────────────────────

	async pause(id: string): Promise<void> {
		const p = await this.need(id);
		if (p.status !== "running") bad("Only a running project can be paused.");
		p.status = "paused";
		p.statusNote = "Paused. Tasks that are running will finish their current step.";
		this.addLog(p, "info", "Paused by you.");
		this.commit(p);
	}

	async resume(id: string): Promise<void> {
		const p = await this.need(id);
		if (p.status !== "paused") bad("Only a paused project can be resumed.");
		if (p.budgetUsd !== undefined && p.spentUsd >= p.budgetUsd) {
			this.addLog(p, "info", `Resumed past the budget of $${p.budgetUsd.toFixed(2)}.`);
			p.budgetUsd = undefined;
		} else this.addLog(p, "info", "Resumed.");
		p.status = "running";
		p.statusNote = undefined;
		await this.warmNames(p);
		this.commit(p);
		this.tick(p);
	}

	async cancel(id: string): Promise<void> {
		const p = await this.need(id);
		if (p.status === "done" || p.status === "failed" || p.status === "cancelled")
			bad("This project has already finished.");
		for (const t of p.tasks) {
			this.inflight.get(key(p.id, t.id))?.abort();
			if (!isDoneOrSkipped(t) && t.status !== "failed") {
				t.status = "skipped";
				t.error = "Cancelled.";
				t.finishedAt = this.deps.now().toISOString();
			}
		}
		p.status = "cancelled";
		p.statusNote = "Cancelled by you.";
		this.planBackup.delete(p.id);
		this.addLog(p, "info", "Cancelled by you.");
		this.commit(p);
	}

	async deleteProject(id: string): Promise<void> {
		const p = await this.need(id);
		if (p.status !== "done" && p.status !== "failed" && p.status !== "cancelled")
			bad("Cancel the project before deleting it.");
		this.projects.delete(id);
		const t = this.emitTimers.get(id);
		if (t) clearTimeout(t);
		this.emitTimers.delete(id);
		await this.deps.repo.delete(id);
	}

	// ───────────────────────── the user's moves ─────────────────────────

	async answerTask(id: string, taskId: string, answer: string): Promise<void> {
		const p = await this.need(id);
		const t = this.task(p, taskId);
		if (t.status !== "needs-input") bad("This task isn't waiting for an answer.");
		if (p.status !== "running") bad("Resume the project before answering.");
		const text = answer.trim();
		if (!text) bad("Write an answer first.", "INVALID");
		t.status = "running";
		t.question = undefined;
		this.addLog(p, "task", `You answered a question on "${t.title}".`, t.id);
		this.commit(p);
		void this.runWork(p.id, t.id, "answer", text);
	}

	async reviewTask(id: string, taskId: string, verdict: "approved" | "changes", note?: string): Promise<void> {
		const p = await this.need(id);
		const t = this.task(p, taskId);
		if (t.status !== "review" || t.reviewer !== "human") bad("This task isn't waiting for your review.");
		if (p.status !== "running" && p.status !== "paused") bad("This project isn't active.");
		const text = (note ?? "").trim();
		if (verdict === "changes" && !text) bad("Say what should change.", "INVALID");
		const review: OrgReview = { verdict, note: text, by: "human", at: this.deps.now().toISOString() };
		t.reviews.push(review);
		this.addLog(p, "review", `You ${verdict === "approved" ? "approved" : "asked for changes on"} "${t.title}".`, t.id);
		if (verdict === "approved") this.markDone(p, t);
		else this.requestRevision(p, t);
		this.commit(p);
		this.tick(p);
	}

	async completeTask(id: string, taskId: string, note?: string): Promise<void> {
		const p = await this.need(id);
		const t = this.task(p, taskId);
		if (t.assignee !== "human" || t.status !== "pending") bad("This isn't a task waiting for you.");
		if (p.status !== "running" && p.status !== "paused") bad("This project isn't active.");
		if (!readyTaskIds(p.tasks).includes(t.id)) bad("Finish the tasks before this one first.");
		const now = this.deps.now().toISOString();
		t.attempt = Math.max(1, t.attempt);
		t.startedAt ??= now;
		t.result = (note ?? "").trim() || "Done by you.";
		this.addLog(p, "task", `You finished "${t.title}".`, t.id);
		this.afterWork(p, t);
		this.commit(p);
		this.tick(p);
	}

	async retryTask(id: string, taskId: string): Promise<void> {
		const p = await this.need(id);
		const t = this.task(p, taskId);
		if (t.status !== "failed" && t.status !== "skipped") bad("Only a failed or skipped task can be retried.");
		this.requireActive(p);
		this.resetTask(t);
		this.reviveBlocked(p);
		this.reviveIfFailed(p);
		this.addLog(p, "task", `Retrying "${t.title}".`, t.id);
		this.commit(p);
		this.tick(p);
	}

	async skipTask(id: string, taskId: string): Promise<void> {
		const p = await this.need(id);
		const t = this.task(p, taskId);
		if (t.status !== "pending" && t.status !== "failed" && t.status !== "needs-input")
			bad("This task can't be skipped now.");
		this.requireActive(p);
		t.status = "skipped";
		t.error = undefined;
		t.question = undefined;
		t.finishedAt = this.deps.now().toISOString();
		this.reviveBlocked(p);
		this.reviveIfFailed(p);
		this.addLog(p, "task", `You skipped "${t.title}".`, t.id);
		this.commit(p);
		this.tick(p);
	}

	private requireActive(p: OrgProject): void {
		if (p.status !== "running" && p.status !== "paused" && p.status !== "failed") bad("This project isn't active.");
	}

	/** Tasks that were skipped only because something failed get another chance (the next pass skips them again if still blocked). */
	private reviveBlocked(p: OrgProject): void {
		for (const o of p.tasks) if (o.status === "skipped" && o.error?.startsWith(SKIP_PREFIX)) this.resetTask(o);
	}

	private reviveIfFailed(p: OrgProject): void {
		if (p.status !== "failed") return;
		p.status = "running";
		p.statusNote = undefined;
	}

	private resetTask(t: OrgTask): void {
		t.status = "pending";
		t.attempt = 0;
		t.error = undefined;
		t.question = undefined;
		t.result = undefined;
		t.reviews = [];
		t.finishedAt = undefined;
		t.startedAt = undefined;
		this.announced.delete(t.id);
	}

	/** Absolute path of a file deliverable, confined to the assignee's workspace. */
	async deliverablePath(id: string, taskId: string, index: number): Promise<{ path?: string; url?: string }> {
		const p = await this.need(id);
		const t = this.task(p, taskId);
		const d = t.deliverables[index];
		if (!d) throw new OpenDotError("NOT_FOUND", "That file is no longer listed.");
		if (d.kind === "link" && d.url) return { url: d.url };
		if (d.kind !== "file" || !d.path || t.assignee === "human") bad("There is nothing to open here.");
		const dot = await this.deps.dot(t.assignee);
		if (!dot) throw new OpenDotError("NOT_FOUND", "The Dot that made this file no longer exists.");
		const file = await resolveWorkspaceFile(dot.workspaceDir, d.path);
		if (!file) throw new OpenDotError("NOT_FOUND", "That file is no longer in the workspace.");
		return { path: file };
	}

	// ───────────────────────── scheduler ─────────────────────────

	/** One scheduler pass. Synchronous: it only starts work, it never waits for it. */
	private tick(p: OrgProject): void {
		if (this.stopped || p.status !== "running") return;
		this.propagateFailures(p);
		if (allFinished(p)) {
			void this.finalize(p.id);
			return;
		}
		// Reviews by a Dot (the task already holds its slot).
		for (const t of p.tasks) {
			if (t.status === "review" && t.reviewer && t.reviewer !== "human" && !this.reviewing.has(key(p.id, t.id))) {
				this.reviewing.add(key(p.id, t.id));
				void this.runReview(p.id, t.id);
			}
		}
		// Tasks for the user.
		const ready = readyTaskIds(p.tasks);
		for (const id of ready) {
			const t = this.task(p, id);
			if (t.assignee === "human" && !this.announced.has(key(p.id, id))) {
				this.announced.add(key(p.id, id));
				this.tell(p, "needs-input", `Your turn on "${p.title}": ${t.title}.`);
			}
		}
		// New work, up to the concurrency cap. Revisions go first.
		let slots = p.tasks.filter(
			(t) => t.status === "running" || t.status === "needs-input" || (t.status === "review" && t.reviewer !== "human"),
		).length;
		const todo = ready
			.map((id) => this.task(p, id))
			.filter((t) => t.assignee !== "human")
			.sort((a, b) => Number(b.attempt > 1) - Number(a.attempt > 1));
		for (const t of todo) {
			if (slots >= Math.min(p.concurrency, ORG_LIMITS.maxConcurrency)) break;
			slots++;
			this.startTask(p, t);
		}
		// Nothing can move and something failed: stop here and say why.
		const active = p.tasks.some((t) => t.status === "running" || t.status === "needs-input" || t.status === "review");
		if (!active && ready.length === 0) {
			const failed = p.tasks.find((t) => t.status === "failed");
			if (failed) {
				p.status = "failed";
				p.statusNote = `Stopped because "${failed.title}" failed. Retry it or skip it to continue.`;
				this.addLog(p, "error", `The project stopped because "${failed.title}" failed.`, failed.id);
				this.commit(p);
				this.tell(p, "failed", `"${p.title}" stopped because "${failed.title}" failed.`);
			}
		}
	}

	/** Pending tasks that can never start because something they need failed (or was skipped for that reason). */
	private propagateFailures(p: OrgProject): void {
		for (let changed = true; changed; ) {
			changed = false;
			const blocked = new Set(blockedByFailure(p.tasks));
			for (const t of p.tasks) {
				if (t.status !== "pending") continue;
				const poisoned = t.dependsOn
					.map((d) => p.tasks.find((x) => x.id === d))
					.find((d) => d && (d.status === "failed" || (d.status === "skipped" && d.error?.startsWith(SKIP_PREFIX))));
				if (!blocked.has(t.id) && !poisoned) continue;
				t.status = "skipped";
				t.error = `${SKIP_PREFIX} "${poisoned?.title ?? "a task it needs"}" didn't finish.`;
				t.finishedAt = this.deps.now().toISOString();
				this.addLog(p, "task", `Skipped "${t.title}" because a task it needs didn't finish.`, t.id);
				changed = true;
			}
			if (changed) this.commit(p);
		}
	}

	private startTask(p: OrgProject, t: OrgTask): void {
		t.status = "running";
		if (t.attempt === 0) t.attempt = 1;
		t.startedAt = this.deps.now().toISOString();
		t.finishedAt = undefined;
		t.error = undefined;
		t.question = undefined;
		this.addLog(p, "task", `Started "${t.title}"${t.attempt > 1 ? ` (round ${t.attempt})` : ""}.`, t.id);
		this.commit(p);
		const revision = lastReview(t)?.verdict === "changes";
		void this.runWork(p.id, t.id, revision ? "revision" : "start");
	}

	private afterTurn(p: OrgProject): void {
		if (p.budgetUsd !== undefined && p.spentUsd >= p.budgetUsd && p.status === "running") {
			p.status = "paused";
			p.statusNote = "Budget reached";
			this.addLog(p, "info", `Paused: the budget of $${p.budgetUsd.toFixed(2)} was reached.`);
			this.commit(p);
			this.tell(p, "paused", `"${p.title}" paused: budget reached.`);
		}
		this.tick(p);
	}

	// ───────────────────────── running a task ─────────────────────────

	private async runWork(
		pid: string,
		tid: string,
		mode: "start" | "revision" | "answer",
		answer?: string,
	): Promise<void> {
		const k = key(pid, tid);
		const ctrl = new AbortController();
		this.inflight.set(k, ctrl);
		try {
			const p0 = this.projects.get(pid);
			const t0 = p0?.tasks.find((x) => x.id === tid);
			if (!p0 || !t0 || t0.assignee === "human") return;
			const dot = await this.deps.dot(t0.assignee);
			if (!dot || dot.archived) {
				this.failTask(pid, tid, "This Dot is no longer available.");
				return;
			}
			this.names.set(dot.id, dot.name);
			await this.warmNames(p0);
			let prompt: string;
			if (mode === "answer") prompt = answerPrompt(p0, t0, answer ?? "");
			else if (mode === "revision") prompt = revisionPrompt(p0, t0, lastReview(t0)?.note ?? "");
			else prompt = taskPrompt(p0, t0, this.depInfos(p0, t0));
			if (mode !== "answer" || !this.snapshots.has(k))
				this.snapshots.set(k, await snapshotTaskFiles(dot.workspaceDir, pid, tid));
			const sup = await this.deps.superDot();
			const c0 = this.deps.costOf(dot.id);
			const res = await this.deps.runTask(sup, dot.id, prompt, {
				signal: ctrl.signal,
				timeoutMs: ORG_LIMITS.taskTimeoutMin * 60_000,
			});
			if (this.deps.settleMs) await new Promise((r) => setTimeout(r, this.deps.settleMs));
			const cost = Math.max(0, this.deps.costOf(dot.id) - c0);
			if (this.stopped || ctrl.signal.aborted) return;
			const p = this.projects.get(pid);
			const t = p?.tasks.find((x) => x.id === tid);
			if (!p || !t || t.status !== "running") return;
			p.spentUsd += cost;
			if (!res.ok) {
				this.failTask(pid, tid, res.reason);
				return;
			}
			const parsed = parseTaskReply(res.reply);
			if (parsed.kind === "blocked") {
				t.status = "needs-input";
				t.question = parsed.text.slice(0, ORG_LIMITS.answerMax);
				this.addLog(p, "task", `${dot.name} has a question on "${t.title}".`, t.id);
				this.commit(p);
				this.tell(p, "needs-input", `${dot.name} has a question on "${t.title}" in "${p.title}".`);
				this.afterTurn(p);
				return;
			}
			t.result = parsed.text;
			t.deliverables = await collectDeliverables(dot.workspaceDir, pid, tid, this.snapshots.get(k), t.deliverables);
			if (this.stopped || ctrl.signal.aborted || t.status !== "running") return;
			this.addLog(
				p,
				"task",
				`${dot.name} finished "${t.title}"${t.deliverables.length ? ` with ${t.deliverables.length} file(s)` : ""}.`,
				t.id,
			);
			this.afterWork(p, t);
			this.commit(p);
			this.afterTurn(p);
		} catch (e) {
			log.warn("organisation: task run failed", e instanceof Error ? e.message : String(e));
			if (!this.stopped && !ctrl.signal.aborted)
				this.failTask(pid, tid, "Something went wrong while running this task.");
		} finally {
			if (this.inflight.get(k) === ctrl) this.inflight.delete(k);
		}
	}

	private depInfos(p: OrgProject, t: OrgTask) {
		return t.dependsOn
			.map((id) => p.tasks.find((x) => x.id === id))
			.filter((d): d is OrgTask => !!d)
			.map((d) => ({
				title: d.title,
				assigneeName: d.assignee === "human" ? "you" : this.nameOf(d.assignee),
				result: d.result,
				deliverables: d.deliverables.map((x) => x.title),
			}));
	}

	/** After the assignee's [DONE] (or the user finishing their own task): review, or done. */
	private afterWork(p: OrgProject, t: OrgTask): void {
		if (t.reviewer) {
			t.status = "review";
			if (t.reviewer === "human") {
				this.addLog(p, "review", `"${t.title}" waits for your review.`, t.id);
				this.tell(p, "needs-review", `"${t.title}" in "${p.title}" is ready for your review.`);
			} else this.addLog(p, "review", `"${t.title}" goes to ${this.nameOf(t.reviewer)} for review.`, t.id);
		} else this.markDone(p, t);
	}

	private markDone(p: OrgProject, t: OrgTask): void {
		t.status = "done";
		t.finishedAt = this.deps.now().toISOString();
		this.addLog(p, "task", `"${t.title}" is done.`, t.id);
	}

	private requestRevision(p: OrgProject, t: OrgTask): void {
		t.attempt += 1;
		t.status = "pending";
		this.addLog(p, "review", `Changes were requested on "${t.title}" (round ${t.attempt}).`, t.id);
	}

	private failTask(pid: string, tid: string, reason: string): void {
		const p = this.projects.get(pid);
		const t = p?.tasks.find((x) => x.id === tid);
		if (!p || !t) return;
		t.status = "failed";
		t.error = reason.slice(0, 400);
		t.finishedAt = this.deps.now().toISOString();
		this.addLog(p, "error", `"${t.title}" failed: ${t.error}`, t.id);
		this.commit(p);
		this.afterTurn(p);
	}

	// ───────────────────────── review loop ─────────────────────────

	private async runReview(pid: string, tid: string): Promise<void> {
		const k = key(pid, tid);
		const ctrl = new AbortController();
		this.inflight.set(`${k}:review`, ctrl);
		try {
			const p0 = this.projects.get(pid);
			const t0 = p0?.tasks.find((x) => x.id === tid);
			if (!p0 || !t0?.reviewer || t0.reviewer === "human") return;
			const reviewerId = t0.reviewer;
			const reviewer = await this.deps.dot(reviewerId);
			if (!reviewer || reviewer.archived) {
				this.handToUser(pid, tid, "The reviewer is no longer available.");
				return;
			}
			this.names.set(reviewer.id, reviewer.name);
			await this.warmNames(p0);
			const assignee = t0.assignee === "human" ? undefined : await this.deps.dot(t0.assignee);
			const texts = assignee ? await readTextDeliverables(assignee.workspaceDir, t0.deliverables) : [];
			const prompt = reviewPrompt(
				p0,
				t0,
				this.nameOf(t0.assignee),
				t0.deliverables.map((d) => d.title),
				texts,
			);
			const sup = await this.deps.superDot();
			const c0 = this.deps.costOf(reviewer.id);
			const res = await this.deps.runTask(sup, reviewer.id, prompt, {
				signal: ctrl.signal,
				timeoutMs: ORG_LIMITS.taskTimeoutMin * 60_000,
			});
			if (this.deps.settleMs) await new Promise((r) => setTimeout(r, this.deps.settleMs));
			const cost = Math.max(0, this.deps.costOf(reviewer.id) - c0);
			if (this.stopped || ctrl.signal.aborted) return;
			const p = this.projects.get(pid);
			const t = p?.tasks.find((x) => x.id === tid);
			if (!p || !t || t.status !== "review" || t.reviewer !== reviewerId) return;
			p.spentUsd += cost;
			const verdict = res.ok ? parseReviewReply(res.reply) : undefined;
			if (!res.ok) this.handToUser(pid, tid, `${reviewer.name} couldn't review it: ${res.reason}`);
			else if (verdict?.verdict === "unclear") this.handToUser(pid, tid, `${reviewer.name}'s answer wasn't clear.`);
			else if (verdict) {
				t.reviews.push({
					verdict: verdict.verdict as "approved" | "changes",
					note: verdict.note,
					by: reviewer.id,
					at: this.deps.now().toISOString(),
				});
				this.addLog(
					p,
					"review",
					`${reviewer.name} ${verdict.verdict === "approved" ? "approved" : "asked for changes on"} "${t.title}".`,
					t.id,
				);
				if (verdict.verdict === "approved") this.markDone(p, t);
				else if (t.reviews.filter((r) => r.verdict === "changes").length > p.maxRevisions)
					this.handToUser(pid, tid, "It went through several rounds of changes.");
				else this.requestRevision(p, t);
				this.commit(p);
			}
			this.afterTurn(p);
		} catch (e) {
			log.warn("organisation: review failed", e instanceof Error ? e.message : String(e));
			if (!this.stopped && !ctrl.signal.aborted) this.handToUser(pid, tid, "The review couldn't be done.");
		} finally {
			this.reviewing.delete(k);
			if (this.inflight.get(`${k}:review`) === ctrl) this.inflight.delete(`${k}:review`);
		}
	}

	/** The user decides this review (unclear answer, no reply, or too many rounds). */
	private handToUser(pid: string, tid: string, why: string): void {
		const p = this.projects.get(pid);
		const t = p?.tasks.find((x) => x.id === tid);
		if (!p || !t || t.status !== "review") return;
		t.reviewer = "human";
		this.addLog(p, "review", `"${t.title}" was handed to you for review. ${why}`, t.id);
		this.commit(p);
		this.tell(p, "needs-review", `"${t.title}" in "${p.title}" needs your review. ${why}`);
		this.afterTurn(p);
	}

	// ───────────────────────── final report ─────────────────────────

	private async finalize(pid: string): Promise<void> {
		if (this.finalizing.has(pid)) return;
		this.finalizing.add(pid);
		try {
			const p0 = this.projects.get(pid);
			if (!p0) return;
			await this.warmNames(p0);
			const r = await this.deps
				.runHiddenSuperTurn({ kind: "report", projectId: pid, prompt: reportPrompt(p0, (id) => this.nameOf(id)) })
				.catch((): HiddenTurnResult => ({ text: "", error: "failed" }));
			const p = this.projects.get(pid);
			if (!p || this.stopped || (p.status !== "running" && p.status !== "paused") || !allFinished(p)) return;
			p.summary = r.text.trim() || fallbackSummary(p, (id) => this.nameOf(id));
			p.status = "done";
			p.statusNote = undefined;
			this.addLog(p, "info", "The project is done.");
			this.commit(p);
			this.tell(p, "done", `"${p.title}" is done. Open it to read the report.`);
		} finally {
			this.finalizing.delete(pid);
		}
	}

	// ───────────────────────── status text (SuperDot's project_status) ─────────────────────────

	async statusText(projectId?: string): Promise<string> {
		await this.start();
		const list = projectId
			? [this.projects.get(projectId)].filter((p): p is OrgProject => !!p)
			: [...this.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);
		if (!list.length) return projectId ? `No project with id "${projectId}".` : "There are no projects yet.";
		await Promise.all(list.map((p) => this.warmNames(p)));
		return list
			.map((p) => {
				const head = `${p.title} (${p.id}): ${p.status}, ${p.tasks.filter(isDoneOrSkipped).length} of ${p.tasks.length} tasks done${p.statusNote ? `. ${p.statusNote}` : ""}`;
				const rows = p.tasks.map((t) => {
					const waiting = t.dependsOn.filter((d) => !isDoneOrSkipped(this.task(p, d)));
					return `- ${t.id} ${t.title} (${this.nameOf(t.assignee)}): ${t.status}${t.status === "needs-input" ? " (waiting for the user)" : ""}${
						t.status === "review" ? ` (waiting for ${this.nameOf(t.reviewer ?? "human")})` : ""
					}${waiting.length && t.status === "pending" ? ` (waiting on ${waiting.join(", ")})` : ""}`;
				});
				return [head, ...rows].join("\n");
			})
			.join("\n\n");
	}

	// ───────────────────────── notifications, log, persistence ─────────────────────────

	private tell(p: OrgProject, kind: OrgUpdateView["kind"], text: string): void {
		const titles: Record<OrgUpdateView["kind"], string> = {
			"plan-ready": "Plan ready",
			"needs-input": "Waiting for you",
			"needs-review": "Review needed",
			done: "Project done",
			failed: "Project stopped",
			paused: "Project paused",
		};
		try {
			this.deps.notify({ title: titles[kind], body: text, hash: `#/organisation/${p.id}` });
		} catch (e) {
			log.warn("organisation: notify failed", e instanceof Error ? e.message : String(e));
		}
		this.deps.postUpdate({ projectId: p.id, title: p.title, kind, text }).catch((e) => {
			log.warn("organisation: chat update failed", e instanceof Error ? e.message : String(e));
		});
	}

	private addLog(p: OrgProject, kind: OrgLogEntry["kind"], text: string, taskId?: string): void {
		p.log.push({ at: this.deps.now().toISOString(), kind, text, ...(taskId ? { taskId } : {}) });
		if (p.log.length > ORG_LIMITS.logMax) p.log.splice(0, p.log.length - ORG_LIMITS.logMax);
	}

	/** Marks the project changed: one save and one event per burst of changes. */
	private commit(p: OrgProject): void {
		p.updatedAt = this.deps.now().toISOString();
		if (this.dirty.has(p.id)) return;
		this.dirty.add(p.id);
		queueMicrotask(() => {
			this.dirty.delete(p.id);
			if (!this.projects.has(p.id)) return;
			const snap = clone(p);
			const save = this.deps.repo
				.save(snap)
				.catch((e) => log.warn("organisation: saving a project failed", e instanceof Error ? e.message : String(e)))
				.finally(() => this.saves.delete(save));
			this.saves.add(save);
			this.emitThrottled(snap);
		});
	}

	private emitThrottled(p: OrgProject): void {
		const gap = this.deps.throttleMs ?? 100;
		const now = Date.now();
		const last = this.lastEmit.get(p.id) ?? 0;
		if (gap <= 0 || now - last >= gap) {
			this.lastEmit.set(p.id, now);
			this.deps.emit(p);
			return;
		}
		if (this.emitTimers.has(p.id)) return;
		this.emitTimers.set(
			p.id,
			setTimeout(
				() => {
					this.emitTimers.delete(p.id);
					const cur = this.projects.get(p.id);
					if (!cur) return;
					this.lastEmit.set(p.id, Date.now());
					this.deps.emit(clone(cur));
				},
				gap - (now - last),
			),
		);
	}
}

function toTask(i: OrgTaskInput): OrgTask {
	return {
		id: i.id,
		title: i.title,
		brief: i.brief,
		assignee: i.assignee,
		dependsOn: [...i.dependsOn],
		...(i.reviewer ? { reviewer: i.reviewer } : {}),
		status: "pending",
		attempt: 0,
		reviews: [],
		deliverables: [],
	};
}
