// OpenDot Organisation: shared types, limits and pure helpers (docs/spec/15-organisation.md).
// Pure TypeScript with no Node or Electron imports, so main and renderer can both use it.
import type { DotColor, DotId, ISODate } from "./types";

// ───────────────────────── Catalog (domains, templates, skills) ─────────────────────────

/** A department an organisation can have a Dot for ("engineering", "hr", ...). Also used as the Dot's role. */
export interface OrgDomain {
	id: string;
	name: string;
	emoji: string;
	color: DotColor;
	tagline: string;
	/** Built-in skill ids this domain's Dot starts with. */
	skillIds: string[];
	/** Domains whose Dots usually review this domain's work (planner hint), e.g. engineering ← security. */
	reviewedBy: string[];
}

export interface OrgTemplate {
	id: string;
	name: string;
	description: string;
	/** Domain ids created by this template. */
	domains: string[];
}

export interface SkillSummary {
	id: string;
	name: string;
	/** One line the Dot sees in its skill list. */
	description: string;
	/** Domain it belongs to, if any (shown as a group). */
	domain?: string;
	builtin: boolean;
}

export interface Skill extends SkillSummary {
	/** Markdown playbook. */
	body: string;
	updatedAt: ISODate;
}

export interface SkillInput {
	/** Omit to create a skill. Built-in skills can't be edited; saving one creates an editable copy with a new id. */
	id?: string;
	name: string;
	description: string;
	domain?: string;
	body: string;
}

// ───────────────────────── Team ─────────────────────────

export interface OrgMember {
	dotId: DotId;
	/** OrgDomain id (or a custom string). */
	domain: string;
	skillIds: string[];
}

export interface OrgState {
	/** True once the user has set up an organisation (applied a template or added a domain). */
	created: boolean;
	name: string;
	templateId?: string;
	members: OrgMember[];
}

// ───────────────────────── Projects ─────────────────────────

export type OrgProjectStatus =
	| "planning"
	| "awaiting-approval"
	| "running"
	| "paused"
	| "done"
	| "failed"
	| "cancelled";

export type OrgTaskStatus =
	| "pending" // waiting for its dependencies or a free slot
	| "running"
	| "needs-input" // the assignee asked the user a question
	| "review" // done by the assignee, waiting for the reviewer (a Dot or the user)
	| "done"
	| "failed"
	| "skipped";

export interface OrgDeliverable {
	kind: "file" | "link" | "text";
	title: string;
	/** kind "file": path relative to the assignee's workspace folder. */
	path?: string;
	/** kind "link". */
	url?: string;
	/** kind "text". */
	text?: string;
}

export interface OrgReview {
	verdict: "approved" | "changes";
	note: string;
	/** Reviewer Dot id, or "human". */
	by: DotId | "human";
	at: ISODate;
}

export interface OrgTask {
	/** Short id unique inside the project: "t1", "t2", ... */
	id: string;
	title: string;
	/** What to do and how we know it's done. */
	brief: string;
	/** The Dot that does it, or "human" for a task the user does (waits until they mark it done). */
	assignee: DotId | "human";
	dependsOn: string[];
	/** Optional: who checks the result before the task counts as done. */
	reviewer?: DotId | "human";
	status: OrgTaskStatus;
	/** Work rounds so far (1 = first run, 2 = after one round of requested changes, ...). */
	attempt: number;
	/** The assignee's latest reply (what they did, in their words). */
	result?: string;
	reviews: OrgReview[];
	deliverables: OrgDeliverable[];
	/** Set while status is "needs-input". */
	question?: string;
	error?: string;
	startedAt?: ISODate;
	finishedAt?: ISODate;
}

/** What the user (or the planner) provides for a task; everything else is managed by OpenDot. */
export interface OrgTaskInput {
	id: string;
	title: string;
	brief: string;
	assignee: DotId | "human";
	dependsOn: string[];
	reviewer?: DotId | "human";
}

export interface OrgLogEntry {
	at: ISODate;
	kind: "info" | "task" | "review" | "error";
	taskId?: string;
	text: string;
}

export interface OrgProject {
	id: string;
	title: string;
	/** The request, in the user's words. */
	brief: string;
	status: OrgProjectStatus;
	createdAt: ISODate;
	updatedAt: ISODate;
	tasks: OrgTask[];
	/** SuperDot's one-paragraph explanation of the plan. */
	plannerNote?: string;
	/** SuperDot's final report, written when the project is done. */
	summary?: string;
	/** Tasks that may run at the same time. */
	concurrency: number;
	/** Rounds of requested changes before a task is handed to the user. */
	maxRevisions: number;
	/** Stop (pause) when spending reaches this. Omit for no cap. */
	budgetUsd?: number;
	spentUsd: number;
	/** Why it is paused or failed, in plain words. */
	statusNote?: string;
	log: OrgLogEntry[];
}

export interface OrgProjectSummary {
	id: string;
	title: string;
	status: OrgProjectStatus;
	updatedAt: ISODate;
	taskCount: number;
	doneCount: number;
	/** Things only the user can move forward: plan to approve, questions, reviews, human tasks. */
	attention: number;
	spentUsd: number;
}

export interface OrgCreateProjectInput {
	title: string;
	brief: string;
	budgetUsd?: number;
}

/** Pushed to the chat of SuperDot when a project changes in a way the user should see. */
export interface OrgUpdateView {
	projectId: string;
	title: string;
	kind: "plan-ready" | "needs-input" | "needs-review" | "done" | "failed" | "paused";
	text: string;
}

// ───────────────────────── Limits and defaults ─────────────────────────

export const ORG_LIMITS = {
	maxTasks: 20,
	titleMax: 120,
	briefMax: 4000,
	projectBriefMax: 8000,
	projectTitleMax: 120,
	answerMax: 4000,
	logMax: 200,
	defaultConcurrency: 3,
	maxConcurrency: 6,
	defaultMaxRevisions: 2,
	/** A task may run this long before it is stopped and marked failed. */
	taskTimeoutMin: 30,
} as const;

// ───────────────────────── Pure helpers ─────────────────────────

const TERMINAL_TASK: ReadonlySet<OrgTaskStatus> = new Set(["done", "failed", "skipped"]);
export const isTaskFinished = (s: OrgTaskStatus): boolean => TERMINAL_TASK.has(s);
export const isProjectFinished = (s: OrgProjectStatus): boolean => s === "done" || s === "failed" || s === "cancelled";

export interface PlanProblem {
	taskId?: string;
	message: string;
}

/**
 * Checks a proposed plan. `isKnownDot` says whether an assignee/reviewer Dot id is part of the team.
 * Returns every problem found, in plain language (they are shown to the planner model and to the user).
 */
export function validatePlan(tasks: OrgTaskInput[], isKnownDot: (id: DotId) => boolean): PlanProblem[] {
	const problems: PlanProblem[] = [];
	if (tasks.length === 0) problems.push({ message: "The plan has no tasks." });
	if (tasks.length > ORG_LIMITS.maxTasks)
		problems.push({ message: `The plan has ${tasks.length} tasks; the most allowed is ${ORG_LIMITS.maxTasks}.` });
	const ids = new Set<string>();
	for (const t of tasks) {
		if (!/^[A-Za-z0-9_-]{1,24}$/.test(t.id))
			problems.push({ taskId: t.id, message: `"${t.id}" is not a valid task id.` });
		if (ids.has(t.id)) problems.push({ taskId: t.id, message: `Task id "${t.id}" is used twice.` });
		ids.add(t.id);
		if (!t.title.trim()) problems.push({ taskId: t.id, message: `Task ${t.id} has no title.` });
		if (!t.brief.trim()) problems.push({ taskId: t.id, message: `Task ${t.id} has no brief.` });
		if (t.assignee !== "human" && !isKnownDot(t.assignee))
			problems.push({ taskId: t.id, message: `Task ${t.id} is assigned to someone who isn't on the team.` });
		if (t.reviewer && t.reviewer !== "human" && !isKnownDot(t.reviewer))
			problems.push({ taskId: t.id, message: `Task ${t.id} has a reviewer who isn't on the team.` });
		if (t.reviewer && t.reviewer === t.assignee)
			problems.push({ taskId: t.id, message: `Task ${t.id}: a task can't be reviewed by its own assignee.` });
	}
	for (const t of tasks) {
		for (const d of t.dependsOn) {
			if (d === t.id) problems.push({ taskId: t.id, message: `Task ${t.id} depends on itself.` });
			else if (!ids.has(d))
				problems.push({ taskId: t.id, message: `Task ${t.id} depends on "${d}", which doesn't exist.` });
		}
	}
	// Cycle check (Kahn). Only meaningful when all ids are unique and known.
	if (!problems.some((p) => /depends on/.test(p.message) || /used twice/.test(p.message))) {
		const indeg = new Map<string, number>(tasks.map((t) => [t.id, t.dependsOn.length]));
		const queue = tasks.filter((t) => t.dependsOn.length === 0).map((t) => t.id);
		let seen = 0;
		while (queue.length) {
			const id = queue.shift()!;
			seen++;
			for (const t of tasks) {
				if (!t.dependsOn.includes(id)) continue;
				const n = (indeg.get(t.id) ?? 0) - 1;
				indeg.set(t.id, n);
				if (n === 0) queue.push(t.id);
			}
		}
		if (seen < tasks.length) problems.push({ message: "The tasks depend on each other in a circle." });
	}
	return problems;
}

/** Ids of pending Dot tasks whose dependencies are all finished (done or skipped) and that are free to start. */
export function readyTaskIds(tasks: OrgTask[]): string[] {
	const byId = new Map(tasks.map((t) => [t.id, t]));
	return tasks
		.filter(
			(t) =>
				t.status === "pending" &&
				t.dependsOn.every((d) => {
					const dep = byId.get(d);
					return dep !== undefined && (dep.status === "done" || dep.status === "skipped");
				}),
		)
		.map((t) => t.id);
}

/** A pending task that can never start because something it depends on failed. */
export function blockedByFailure(tasks: OrgTask[]): string[] {
	const byId = new Map(tasks.map((t) => [t.id, t]));
	return tasks
		.filter((t) => t.status === "pending" && t.dependsOn.some((d) => byId.get(d)?.status === "failed"))
		.map((t) => t.id);
}

/** How many things need the user right now (shown as the badge on the Organisation item). */
export function projectAttention(p: Pick<OrgProject, "status" | "tasks">): number {
	if (p.status === "awaiting-approval") return 1;
	if (p.status !== "running" && p.status !== "paused") return 0;
	let n = 0;
	for (const t of p.tasks) {
		if (t.status === "needs-input") n++;
		else if (t.status === "review" && t.reviewer === "human") n++;
		else if (t.status === "pending" && t.assignee === "human" && readyTaskIds(p.tasks).includes(t.id)) n++;
		else if (t.status === "running" && t.assignee === "human") n++;
	}
	return n;
}

export function summarizeProject(p: OrgProject): OrgProjectSummary {
	return {
		id: p.id,
		title: p.title,
		status: p.status,
		updatedAt: p.updatedAt,
		taskCount: p.tasks.length,
		doneCount: p.tasks.filter((t) => t.status === "done" || t.status === "skipped").length,
		attention: projectAttention(p),
		spentUsd: p.spentUsd,
	};
}

/** Parses an assignee's reply into the protocol outcome (docs/spec/15-organisation.md §6). */
export function parseTaskReply(reply: string): { kind: "done" | "blocked"; text: string } {
	const t = reply.trim();
	const m = /^\[BLOCKED\]\s*([\s\S]*)$/i.exec(t);
	if (m) return { kind: "blocked", text: m[1]!.trim() || "I need your input to continue." };
	return { kind: "done", text: t.replace(/^\[DONE\]\s*/i, "") };
}

/** Parses a reviewer's reply: "[APPROVE] ..." or "[CHANGES] ...". Anything else is unclear (the user decides). */
export function parseReviewReply(reply: string): { verdict: "approved" | "changes" | "unclear"; note: string } {
	const t = reply.trim();
	const a = /^\[APPROVE(?:D)?\]\s*([\s\S]*)$/i.exec(t);
	if (a) return { verdict: "approved", note: a[1]!.trim() };
	const c = /^\[CHANGES?\]\s*([\s\S]*)$/i.exec(t);
	if (c) return { verdict: "changes", note: c[1]!.trim() };
	return { verdict: "unclear", note: t };
}
