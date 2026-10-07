import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgProject, OrgState, OrgTaskInput, OrgUpdateView } from "../../shared/organisation";
import type { Dot, DotId } from "../../shared/types";
import {
	type HiddenTurnRequest,
	type NamedTaskInput,
	type ProjectDeps,
	ProjectService,
	type RunTaskResult,
} from "./project-service";
import type { ProjectRepo } from "./project-store";

const ENG = "dot_engineer1" as DotId;
const SEC = "dot_security1" as DotId;
const DES = "dot_designer1" as DotId;
const SUP = "dot_superdot01" as DotId;

class MemRepo implements ProjectRepo {
	data = new Map<string, OrgProject>();
	async list() {
		return [...this.data.values()].map((p) => structuredClone(p));
	}
	async save(p: OrgProject) {
		this.data.set(p.id, structuredClone(p));
	}
	async delete(id: string) {
		this.data.delete(id);
	}
}

interface Call {
	to: DotId;
	prompt: string;
	signal: AbortSignal;
	resolve: (r: RunTaskResult) => void;
}

class Harness {
	root = mkdtempSync(join(tmpdir(), "opendot-proj-"));
	repo = new MemRepo();
	dots = new Map<DotId, Dot>();
	org: OrgState;
	calls: Call[] = [];
	/** When set, calls are answered by this function instead of waiting for the test. */
	auto?: (c: { to: DotId; prompt: string; n: number }) => RunTaskResult | Promise<RunTaskResult>;
	started = 0;
	updates: OrgUpdateView[] = [];
	notes: Array<{ title: string; body: string; hash: string }> = [];
	events: OrgProject[] = [];
	hidden: HiddenTurnRequest[] = [];
	/** By default the planner turn stays open (the plan arrives through proposePlan) and the report turn answers at once. */
	hiddenReply: (r: HiddenTurnRequest) => { text: string; error?: string } | Promise<{ text: string; error?: string }> =
		(r) => (r.kind === "report" ? { text: "REPORT" } : new Promise(() => undefined));
	cost = new Map<DotId, number>();
	clock = Date.parse("2026-01-01T10:00:00Z");
	svc!: ProjectService;
	extra: Partial<ProjectDeps> = {};

	constructor() {
		for (const [id, name] of [
			[ENG, "Engineering"],
			[SEC, "Security"],
			[DES, "Design"],
		] as const) {
			const workspaceDir = join(this.root, id, "workspace");
			mkdirSync(workspaceDir, { recursive: true });
			this.dots.set(id, {
				id,
				name,
				tagline: `${name} work`,
				workspaceDir,
				archived: false,
				kind: "standard",
			} as unknown as Dot);
		}
		this.org = {
			created: true,
			name: "Acme",
			members: [
				{ dotId: ENG, domain: "engineering", skillIds: [] },
				{ dotId: SEC, domain: "security", skillIds: [] },
				{ dotId: DES, domain: "design", skillIds: [] },
			],
		};
		this.build();
	}

	build(repo: ProjectRepo = this.repo): ProjectService {
		this.svc = new ProjectService({
			repo,
			org: async () => this.org,
			dot: async (id) => this.dots.get(id),
			superDot: async () => ({ id: SUP, name: "SuperDot", kind: "super" }) as unknown as Dot,
			runTask: (_from, to, prompt, o) => {
				const n = ++this.started;
				if (this.auto) return Promise.resolve(this.auto({ to, prompt, n }));
				return new Promise<RunTaskResult>((resolve) => this.calls.push({ to, prompt, signal: o.signal, resolve }));
			},
			runHiddenSuperTurn: async (req) => {
				this.hidden.push(req);
				return this.hiddenReply(req);
			},
			costOf: (id) => this.cost.get(id) ?? 0,
			now: () => {
				this.clock += 1000;
				return new Date(this.clock);
			},
			emit: (p) => this.events.push(p),
			notify: (n) => this.notes.push(n),
			postUpdate: async (u) => {
				this.updates.push(u);
			},
			throttleMs: 0,
			...this.extra,
		});
		return this.svc;
	}

	/** Answers the oldest unanswered call. */
	reply(text: string): void {
		const c = this.calls.shift();
		if (!c) throw new Error("no call waiting");
		c.resolve({ ok: true, reply: text });
	}
	async waitCalls(n: number): Promise<void> {
		await vi.waitFor(() => expect(this.calls.length).toBeGreaterThanOrEqual(n));
	}
	/** Creates a project, plans it with `tasks` (names) and approves it. */
	async running(tasks: NamedTaskInput[], opts: { concurrency?: number; budgetUsd?: number } = {}): Promise<string> {
		const p = await this.svc.create({ title: "Add SSO", brief: "Add single sign-on", budgetUsd: opts.budgetUsd });
		const r = await this.svc.proposePlan(p.id, "Because.", tasks);
		if (!r.ok) throw new Error(r.problems.join("; "));
		if (opts.concurrency) {
			const live = this.svc as unknown as { projects: Map<string, OrgProject> };
			live.projects.get(p.id)!.concurrency = opts.concurrency;
		}
		await this.svc.approve(p.id);
		return p.id;
	}
	async project(id: string): Promise<OrgProject> {
		return this.svc.get(id);
	}
	async untilTask(id: string, taskId: string, status: string): Promise<void> {
		await vi.waitFor(async () =>
			expect((await this.project(id)).tasks.find((t) => t.id === taskId)?.status).toBe(status),
		);
	}
	async untilStatus(id: string, status: string): Promise<void> {
		await vi.waitFor(async () => expect((await this.project(id)).status).toBe(status));
	}
	cleanup(): void {
		this.svc.stop();
		rmSync(this.root, { recursive: true, force: true });
	}
}

const t = (id: string, assignee: string, extra: Partial<NamedTaskInput> = {}): NamedTaskInput => ({
	id,
	title: `Task ${id}`,
	brief: `Do ${id} and say done.`,
	assignee,
	dependsOn: [],
	...extra,
});

let h: Harness;
beforeEach(() => {
	h = new Harness();
});
afterEach(() => h.cleanup());

describe("planning", () => {
	it("creates a project, asks SuperDot to plan, and accepts a plan by Dot names", async () => {
		const p = await h.svc.create({ title: " Add SSO ", brief: "Add single sign-on" });
		expect(p.status).toBe("planning");
		expect(p.title).toBe("Add SSO");
		await vi.waitFor(() => expect(h.hidden.length).toBe(1));
		expect(h.hidden[0]!.kind).toBe("plan");
		expect(h.hidden[0]!.prompt).toContain(p.id);
		expect(h.hidden[0]!.prompt).toContain("Engineering");
		const r = await h.svc.proposePlan(p.id, "Two steps.", [
			t("t1", "engineering"),
			t("t2", "Design", { dependsOn: ["t1"], reviewer: "security" }),
		]);
		expect(r).toEqual({ ok: true, taskCount: 2 });
		const saved = await h.project(p.id);
		expect(saved.status).toBe("awaiting-approval");
		expect(saved.plannerNote).toBe("Two steps.");
		expect(saved.tasks.map((x) => [x.assignee, x.reviewer])).toEqual([
			[ENG, undefined],
			[DES, SEC],
		]);
		expect(h.updates.map((u) => u.kind)).toEqual(["plan-ready"]);
		expect(h.notes[0]!.hash).toBe(`#/organisation/${p.id}`);
		await h.svc.flush();
		expect(h.repo.data.get(p.id)?.status).toBe("awaiting-approval");
	});

	it("reports every problem in plain words so the model can fix the plan", async () => {
		const p = await h.svc.create({ title: "X", brief: "Y" });
		const r = await h.svc.proposePlan(p.id, "n", [
			t("t1", "Nobody"),
			t("t2", "Engineering", { reviewer: "Engineering", dependsOn: ["t9"] }),
			t("t3", "engineering", { dependsOn: ["t4"] }),
			t("t4", "engineering", { dependsOn: ["t3"] }),
		]);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		const text = r.problems.join("\n");
		expect(text).toContain('assignee "Nobody" isn\'t on the team');
		expect(text).toContain("Engineering, Security, Design, human");
		expect(text).toContain("can't be reviewed by its own assignee");
		expect(text).toContain('depends on "t9"');
		expect((await h.project(p.id)).status).toBe("planning");
	});

	it("detects a circle and refuses a plan when the project is not being planned", async () => {
		const p = await h.svc.create({ title: "X", brief: "Y" });
		const circle = await h.svc.proposePlan(p.id, "n", [
			t("t1", "Design", { dependsOn: ["t2"] }),
			t("t2", "Design", { dependsOn: ["t1"] }),
		]);
		expect(circle.ok === false && circle.problems.join(" ")).toContain("circle");
		await h.svc.proposePlan(p.id, "n", [t("t1", "Design")]);
		const again = await h.svc.proposePlan(p.id, "n", [t("t1", "Design")]);
		expect(again.ok).toBe(false);
		expect((await h.svc.proposePlan("prj_missing000", "n", [])).ok).toBe(false);
	});

	it("returns to awaiting-approval with an empty plan when the turn ends without one", async () => {
		h.hiddenReply = () => ({ text: "" });
		const p = await h.svc.create({ title: "X", brief: "Y" });
		await h.untilStatus(p.id, "awaiting-approval");
		const cur = await h.project(p.id);
		expect(cur.tasks).toEqual([]);
		expect(cur.statusNote).toMatch(/plan/i);
		expect(cur.log.some((l) => l.kind === "error")).toBe(true);
	});

	it("replan keeps the old plan when the new turn fails, and asks again with the feedback", async () => {
		const id = await (async () => {
			const p = await h.svc.create({ title: "X", brief: "Y" });
			await h.svc.proposePlan(p.id, "n", [t("t1", "Design")]);
			return p.id;
		})();
		h.hiddenReply = () => ({ text: "" });
		await h.svc.replan(id, "Use fewer tasks");
		await vi.waitFor(() => expect(h.hidden.length).toBe(2));
		expect(h.hidden[1]!.prompt).toContain("Use fewer tasks");
		await h.untilStatus(id, "awaiting-approval");
		expect((await h.project(id)).tasks.map((x) => x.id)).toEqual(["t1"]);
		await expect(h.svc.replan("prj_missing000")).rejects.toThrow(/no longer exists/);
	});

	it("needs a team", async () => {
		h.org = { created: false, name: "", members: [] };
		await expect(h.svc.create({ title: "X", brief: "Y" })).rejects.toThrow(/team/i);
	});

	it("savePlan validates and replaces the tasks; approve needs a valid plan", async () => {
		const p = await h.svc.create({ title: "X", brief: "Y" });
		await h.svc.proposePlan(p.id, "n", [t("t1", "Design")]);
		const input: OrgTaskInput[] = [
			{ id: "a", title: "A", brief: "do a", assignee: ENG, dependsOn: [] },
			{ id: "b", title: "B", brief: "do b", assignee: "human", dependsOn: ["a"], reviewer: SEC },
		];
		const saved = await h.svc.savePlan(p.id, input);
		expect(saved.tasks.map((x) => [x.id, x.status, x.attempt])).toEqual([
			["a", "pending", 0],
			["b", "pending", 0],
		]);
		await expect(h.svc.savePlan(p.id, [{ ...input[0]!, assignee: "dot_stranger1" as DotId }])).rejects.toThrow(
			/isn't on the team/,
		);
		await expect(h.svc.savePlan(p.id, [])).rejects.toThrow(/no tasks/);
		await h.svc.approve(p.id);
		expect((await h.project(p.id)).status).toBe("running");
		await expect(h.svc.savePlan(p.id, input)).rejects.toThrow(/waits for approval/);
		await expect(h.svc.approve(p.id)).rejects.toThrow(/not waiting/);
	});
});

describe("scheduler", () => {
	it("runs tasks in dependency order and in parallel where possible", async () => {
		const id = await h.running([
			t("t1", "Engineering"),
			t("t2", "Design"),
			t("t3", "Engineering", { dependsOn: ["t1", "t2"] }),
		]);
		await h.waitCalls(2);
		// t1 and t2 run together; t3 waits for both.
		expect(h.calls.map((c) => c.to).sort()).toEqual([DES, ENG]);
		expect((await h.project(id)).tasks.map((x) => x.status)).toEqual(["running", "running", "pending"]);
		h.reply("[DONE] built the thing");
		await h.untilTask(id, "t1", "done");
		expect((await h.project(id)).tasks[2]!.status).toBe("pending");
		h.reply("[DONE] designed");
		await h.waitCalls(1);
		const third = h.calls[0]!;
		expect(third.prompt).toContain("Task from the project");
		expect(third.prompt).toContain("## Task t1 (Engineering)");
		expect(third.prompt).toContain("built the thing");
		expect(third.prompt).toContain(`projects/${id}/t3/`);
		h.reply("[DONE] shipped");
		await h.untilStatus(id, "done");
		const done = await h.project(id);
		expect(done.summary).toBe("REPORT");
		expect(h.hidden.at(-1)!.kind).toBe("report");
		expect(h.updates.at(-1)!.kind).toBe("done");
		expect(h.notes.at(-1)!.hash).toBe(`#/organisation/${id}`);
		expect(done.tasks.every((x) => x.status === "done" && x.attempt === 1)).toBe(true);
	});

	it("never runs more tasks than the concurrency cap", async () => {
		const id = await h.running(
			["t1", "t2", "t3", "t4"].map((x) => t(x, "Engineering")),
			{ concurrency: 2 },
		);
		await h.waitCalls(2);
		await new Promise((r) => setTimeout(r, 20));
		expect(h.calls.length).toBe(2);
		h.reply("[DONE] one");
		await h.waitCalls(2);
		expect(h.calls.length).toBe(2);
		expect((await h.project(id)).tasks.filter((x) => x.status === "running").length).toBe(2);
		h.reply("[DONE] two");
		h.reply("[DONE] three");
		await h.waitCalls(1);
		h.reply("[DONE] four");
		await h.untilStatus(id, "done");
	});

	it("uses a fallback summary when the report turn fails", async () => {
		h.hiddenReply = () => ({ text: "", error: "model down" });
		h.auto = () => ({ ok: true, reply: "[DONE] ok" });
		const id = await h.running([t("t1", "Engineering")]);
		await h.untilStatus(id, "done");
		expect((await h.project(id)).summary).toContain("1 of 1 tasks are done");
	});

	it("marks a task failed with a plain reason when the bus refuses, and propagates the failure", async () => {
		h.auto = ({ to }) =>
			to === ENG ? { ok: false, reason: "Engineering didn't reply in time." } : { ok: true, reply: "[DONE] fine" };
		const id = await h.running([
			t("t1", "Engineering"),
			t("t2", "Design", { dependsOn: ["t1"] }),
			t("t3", "Security", { dependsOn: ["t2"] }),
			t("t4", "Design"),
		]);
		await h.untilStatus(id, "failed");
		const p = await h.project(id);
		expect(p.tasks.map((x) => x.status)).toEqual(["failed", "skipped", "skipped", "done"]);
		expect(p.tasks[0]!.error).toBe("Engineering didn't reply in time.");
		expect(p.tasks[2]!.error).toMatch(/^Skipped because/);
		expect(p.statusNote).toContain("Task t1");
		expect(h.updates.at(-1)!.kind).toBe("failed");
		// Retrying the failed task gives the skipped ones another chance.
		h.auto = () => ({ ok: true, reply: "[DONE] now fine" });
		await h.svc.retryTask(id, "t1");
		await h.untilStatus(id, "done");
		expect((await h.project(id)).tasks.map((x) => x.status)).toEqual(["done", "done", "done", "done"]);
	});

	it("skipping a failed task lets the project carry on", async () => {
		h.auto = ({ to }) => (to === ENG ? { ok: false, reason: "no" } : { ok: true, reply: "[DONE] fine" });
		const id = await h.running([t("t1", "Engineering"), t("t2", "Design", { dependsOn: ["t1"] })]);
		await h.untilStatus(id, "failed");
		await h.svc.skipTask(id, "t1");
		await h.untilStatus(id, "done");
		expect((await h.project(id)).tasks.map((x) => x.status)).toEqual(["skipped", "done"]);
		expect(h.hidden.at(-1)!.prompt).toContain("skipped");
	});

	it("pause lets running tasks finish but starts nothing new; resume continues", async () => {
		const id = await h.running([t("t1", "Engineering"), t("t2", "Design", { dependsOn: ["t1"] })]);
		await h.waitCalls(1);
		await h.svc.pause(id);
		h.reply("[DONE] one");
		await h.untilTask(id, "t1", "done");
		await new Promise((r) => setTimeout(r, 20));
		expect(h.calls.length).toBe(0);
		expect((await h.project(id)).tasks[1]!.status).toBe("pending");
		expect((await h.project(id)).status).toBe("paused");
		await h.svc.resume(id);
		await h.waitCalls(1);
		h.reply("[DONE] two");
		await h.untilStatus(id, "done");
	});

	it("cancel aborts running tasks and skips the rest", async () => {
		const id = await h.running([t("t1", "Engineering"), t("t2", "Design", { dependsOn: ["t1"] })]);
		await h.waitCalls(1);
		const call = h.calls[0]!;
		await h.svc.cancel(id);
		expect(call.signal.aborted).toBe(true);
		call.resolve({ ok: false, reason: "aborted" });
		await new Promise((r) => setTimeout(r, 10));
		const p = await h.project(id);
		expect(p.status).toBe("cancelled");
		expect(p.tasks.map((x) => x.status)).toEqual(["skipped", "skipped"]);
		await expect(h.svc.cancel(id)).rejects.toThrow(/already finished/);
		await expect(h.svc.pause(id)).rejects.toThrow();
	});

	it("deletes only finished projects", async () => {
		const id = await h.running([t("t1", "Engineering")]);
		await expect(h.svc.deleteProject(id)).rejects.toThrow(/Cancel/);
		await h.svc.cancel(id);
		await h.svc.deleteProject(id);
		expect(await h.svc.list()).toEqual([]);
		expect(h.repo.data.has(id)).toBe(false);
	});

	it("waits for the user on human tasks and never starts them", async () => {
		const id = await h.running([t("t1", "human"), t("t2", "Engineering", { dependsOn: ["t1"] })]);
		await new Promise((r) => setTimeout(r, 20));
		expect(h.calls.length).toBe(0);
		expect(h.updates.at(-1)!.kind).toBe("needs-input");
		expect((await h.svc.list())[0]!.attention).toBe(1);
		await h.svc.completeTask(id, "t1", "Signed the contract");
		expect((await h.project(id)).tasks[0]).toMatchObject({ status: "done", result: "Signed the contract" });
		await h.waitCalls(1);
		expect(h.calls[0]!.prompt).toContain("Signed the contract");
		await expect(h.svc.completeTask(id, "t2")).rejects.toThrow();
	});
});

describe("restart", () => {
	it("pauses a running project, puts running tasks back to pending and keeps the attempt", async () => {
		const id = await h.running([t("t1", "Engineering"), t("t2", "Design", { dependsOn: ["t1"] })]);
		await h.waitCalls(1);
		await h.svc.flush();
		h.svc.stop();
		const stored = h.repo.data.get(id)!;
		expect(stored.status).toBe("running");
		expect(stored.tasks[0]!.status).toBe("running");
		const h2 = new Harness();
		h2.repo = h.repo;
		h2.build(h.repo);
		await h2.svc.start();
		const p = await h2.svc.get(id);
		expect(p.status).toBe("paused");
		expect(p.statusNote).toBe("OpenDot was closed. Resume when you're ready.");
		expect(p.tasks.map((x) => [x.status, x.attempt])).toEqual([
			["pending", 1],
			["pending", 0],
		]);
		expect(h2.started).toBe(0);
		await h2.svc.resume(id);
		await h2.waitCalls(1);
		expect(h2.calls[0]!.prompt).toContain("Task t1");
		h2.svc.stop();
		h2.cleanup();
	});

	it("sends an interrupted planning project back to awaiting-approval", async () => {
		const p = await h.svc.create({ title: "X", brief: "Y" });
		await h.svc.flush();
		const stored = structuredClone(h.repo.data.get(p.id)!);
		stored.status = "planning";
		const repo = new MemRepo();
		repo.data.set(p.id, stored);
		const h2 = new Harness();
		h2.build(repo);
		await h2.svc.start();
		expect((await h2.svc.get(p.id)).status).toBe("awaiting-approval");
		h2.cleanup();
	});
});

describe("task protocol", () => {
	it("[BLOCKED] asks the user; the answer continues the same task", async () => {
		const id = await h.running([t("t1", "Engineering")]);
		await h.waitCalls(1);
		h.reply("[BLOCKED] Which identity provider should we use?");
		await h.untilTask(id, "t1", "needs-input");
		let p = await h.project(id);
		expect(p.tasks[0]!.question).toBe("Which identity provider should we use?");
		expect(h.updates.at(-1)).toMatchObject({ kind: "needs-input", projectId: id });
		expect((await h.svc.list())[0]!.attention).toBe(1);
		await expect(h.svc.answerTask(id, "t1", "  ")).rejects.toThrow(/answer/);
		await h.svc.answerTask(id, "t1", "Okta");
		await h.waitCalls(1);
		expect(h.calls[0]!.prompt).toContain("Okta");
		expect(h.calls[0]!.to).toBe(ENG);
		h.reply("[DONE] wired up Okta");
		await h.untilStatus(id, "done");
		p = await h.project(id);
		expect(p.tasks[0]).toMatchObject({ status: "done", result: "wired up Okta", attempt: 1 });
		expect(p.tasks[0]!.question).toBeUndefined();
		await expect(h.svc.answerTask(id, "t1", "again")).rejects.toThrow(/isn't waiting/);
	});

	it("a reply without a tag counts as done", async () => {
		const id = await h.running([t("t1", "Engineering")]);
		await h.waitCalls(1);
		h.reply("All finished.");
		await h.untilStatus(id, "done");
		expect((await h.project(id)).tasks[0]!.result).toBe("All finished.");
	});

	it("skip works for a task that is waiting for an answer", async () => {
		const id = await h.running([t("t1", "Engineering")]);
		await h.waitCalls(1);
		h.reply("[BLOCKED] ?");
		await h.untilTask(id, "t1", "needs-input");
		await h.svc.skipTask(id, "t1");
		await h.untilStatus(id, "done");
	});

	it("never writes message contents to the log", async () => {
		const id = await h.running([t("t1", "Engineering")]);
		await h.waitCalls(1);
		h.reply("[DONE] SECRET-RESULT-TEXT");
		await h.untilStatus(id, "done");
		expect(JSON.stringify((await h.project(id)).log)).not.toContain("SECRET-RESULT-TEXT");
	});
});

describe("review loop", () => {
	const twoStep = async () => h.running([t("t1", "Engineering", { reviewer: "Security" })]);

	it("a Dot reviewer approves", async () => {
		const id = await twoStep();
		await h.waitCalls(1);
		h.reply("[DONE] built");
		await h.waitCalls(1);
		expect(h.calls[0]!.to).toBe(SEC);
		expect(h.calls[0]!.prompt).toContain("[APPROVE]");
		expect(h.calls[0]!.prompt).toContain("built");
		expect((await h.project(id)).tasks[0]!.status).toBe("review");
		h.reply("[APPROVE] looks safe");
		await h.untilStatus(id, "done");
		expect((await h.project(id)).tasks[0]!.reviews).toMatchObject([
			{ verdict: "approved", note: "looks safe", by: SEC },
		]);
	});

	it("requested changes go back to the assignee as a revision, then the review repeats", async () => {
		const id = await twoStep();
		await h.waitCalls(1);
		h.reply("[DONE] v1");
		await h.waitCalls(1);
		h.reply("[CHANGES]\n1. Add a test\n2. Hash the token");
		await h.waitCalls(1);
		expect(h.calls[0]!.to).toBe(ENG);
		expect(h.calls[0]!.prompt).toContain("1. Add a test");
		expect(h.calls[0]!.prompt).toContain("reviewer asked for changes");
		expect((await h.project(id)).tasks[0]).toMatchObject({ status: "running", attempt: 2 });
		h.reply("[DONE] v2");
		await h.waitCalls(1);
		expect(h.calls[0]!.to).toBe(SEC);
		h.reply("[APPROVE] ok");
		await h.untilStatus(id, "done");
		const task = (await h.project(id)).tasks[0]!;
		expect(task.reviews.map((r) => r.verdict)).toEqual(["changes", "approved"]);
		expect(task.result).toBe("v2");
	});

	it("hands the task to the user after maxRevisions rounds of changes", async () => {
		const id = await twoStep();
		const live = h.svc as unknown as { projects: Map<string, OrgProject> };
		live.projects.get(id)!.maxRevisions = 1;
		await h.waitCalls(1);
		h.reply("[DONE] v1");
		await h.waitCalls(1);
		h.reply("[CHANGES] one");
		await h.waitCalls(1);
		h.reply("[DONE] v2");
		await h.waitCalls(1);
		h.reply("[CHANGES] two");
		await vi.waitFor(async () => expect((await h.project(id)).tasks[0]!.reviewer).toBe("human"));
		const p = await h.project(id);
		expect(p.tasks[0]).toMatchObject({ status: "review", attempt: 2 });
		expect(p.tasks[0]!.reviews.length).toBe(2);
		expect(h.updates.at(-1)!.kind).toBe("needs-review");
		expect((await h.svc.list())[0]!.attention).toBe(1);
		await h.svc.reviewTask(id, "t1", "approved", "fine by me");
		await h.untilStatus(id, "done");
		expect((await h.project(id)).tasks[0]!.reviews.at(-1)).toMatchObject({ verdict: "approved", by: "human" });
	});

	it("an unclear reviewer answer goes to the user", async () => {
		const id = await twoStep();
		await h.waitCalls(1);
		h.reply("[DONE] v1");
		await h.waitCalls(1);
		h.reply("Hmm, maybe?");
		await vi.waitFor(async () => expect((await h.project(id)).tasks[0]!.reviewer).toBe("human"));
		expect((await h.project(id)).tasks[0]!.reviews).toEqual([]);
		expect(h.updates.at(-1)!.kind).toBe("needs-review");
	});

	it("a reviewer that cannot answer hands the review to the user", async () => {
		const id = await twoStep();
		await h.waitCalls(1);
		h.reply("[DONE] v1");
		await h.waitCalls(1);
		h.calls.shift()!.resolve({ ok: false, reason: "Security is over its budget." });
		await vi.waitFor(async () => expect((await h.project(id)).tasks[0]!.reviewer).toBe("human"));
	});

	it("a human reviewer can request changes, which re-runs the assignee", async () => {
		const id = await h.running([t("t1", "Engineering", { reviewer: "human" })]);
		await h.waitCalls(1);
		h.reply("[DONE] v1");
		await h.untilTask(id, "t1", "review");
		expect(h.updates.at(-1)!.kind).toBe("needs-review");
		await expect(h.svc.reviewTask(id, "t1", "changes", " ")).rejects.toThrow(/what should change/);
		await h.svc.reviewTask(id, "t1", "changes", "Use TypeScript");
		await h.waitCalls(1);
		expect(h.calls[0]!.prompt).toContain("Use TypeScript");
		h.reply("[DONE] v2");
		await h.untilTask(id, "t1", "review");
		await h.svc.reviewTask(id, "t1", "approved");
		await h.untilStatus(id, "done");
	});

	it("rejects a human review on a task that is not waiting for one", async () => {
		const id = await twoStep();
		await expect(h.svc.reviewTask(id, "t1", "approved")).rejects.toThrow(/isn't waiting/);
	});

	it("restarts the review of a task that was in review when the app closed", async () => {
		const id = await twoStep();
		await h.waitCalls(1);
		h.reply("[DONE] v1");
		await h.waitCalls(1);
		await h.svc.flush();
		h.svc.stop();
		const h2 = new Harness();
		h2.build(h.repo);
		await h2.svc.start();
		await h2.svc.resume(id);
		await h2.waitCalls(1);
		expect(h2.calls[0]!.to).toBe(SEC);
		h2.cleanup();
	});
});

describe("budget", () => {
	it("pauses the project when spending reaches the budget", async () => {
		h.auto = ({ to }) => {
			h.cost.set(to, (h.cost.get(to) ?? 0) + 0.6);
			return { ok: true, reply: "[DONE] ok" };
		};
		const id = await h.running(
			[t("t1", "Engineering"), t("t2", "Design", { dependsOn: ["t1"] }), t("t3", "Security", { dependsOn: ["t2"] })],
			{
				budgetUsd: 1,
			},
		);
		await h.untilStatus(id, "paused");
		let p = await h.project(id);
		expect(p.spentUsd).toBeCloseTo(1.2);
		expect(p.statusNote).toBe("Budget reached");
		expect(p.tasks.map((x) => x.status)).toEqual(["done", "done", "pending"]);
		expect(h.updates.at(-1)!.kind).toBe("paused");
		await h.svc.resume(id);
		await h.untilStatus(id, "done");
		p = await h.project(id);
		expect(p.budgetUsd).toBeUndefined();
	});
});

describe("deliverables", () => {
	it("collects new and changed files of the task folder, keeps earlier entries and ignores hidden files", async () => {
		const ws = h.dots.get(ENG)!.workspaceDir;
		let pid = "";
		h.auto = ({ prompt, n }) => {
			const folder = join(ws, "projects", pid, "t1");
			mkdirSync(join(folder, "sub"), { recursive: true });
			writeFileSync(join(folder, n === 1 ? "plan.md" : "plan-v2.md"), `v${n}`);
			writeFileSync(join(folder, "sub", "data.csv"), `a,b\n${n},2`);
			writeFileSync(join(folder, ".hidden"), "x");
			return { ok: true, reply: prompt.includes("Changes requested") ? "[DONE] v2" : "[DONE] v1" };
		};
		const p = await h.svc.create({ title: "X", brief: "Y" });
		pid = p.id;
		await h.svc.proposePlan(p.id, "n", [t("t1", "Engineering", { reviewer: "human" })]);
		await h.svc.approve(p.id);
		await h.untilTask(p.id, "t1", "review");
		let task = (await h.project(p.id)).tasks[0]!;
		expect(task.deliverables.map((d) => d.path)).toEqual([
			`projects/${p.id}/t1/plan.md`,
			`projects/${p.id}/t1/sub/data.csv`,
		]);
		expect(task.deliverables[0]).toMatchObject({ kind: "file", title: "plan.md" });
		await h.svc.reviewTask(p.id, "t1", "changes", "again");
		await vi.waitFor(async () => expect((await h.project(p.id)).tasks[0]!.attempt).toBe(2));
		await h.untilTask(p.id, "t1", "review");
		task = (await h.project(p.id)).tasks[0]!;
		// plan.md is kept, plan-v2.md is new, data.csv was rewritten (same path, single entry).
		expect(task.deliverables.map((d) => d.title)).toEqual(["plan.md", "data.csv", "plan-v2.md"]);
		const open = await h.svc.deliverablePath(p.id, "t1", 0);
		expect(open.path).toBe(join(ws, "projects", p.id, "t1", "plan.md"));
		await expect(h.svc.deliverablePath(p.id, "t1", 9)).rejects.toThrow(/no longer listed/);
	});

	it("refuses to open a deliverable whose stored path escapes the workspace", async () => {
		const id = await h.running([t("t1", "Engineering")]);
		await h.waitCalls(1);
		h.reply("[DONE] ok");
		await h.untilStatus(id, "done");
		const live = h.svc as unknown as { projects: Map<string, OrgProject> };
		const task = live.projects.get(id)!.tasks[0]!;
		for (const bad of ["../../etc/passwd", "/etc/passwd", "C:\\Windows\\win.ini", "..\\..\\x"]) {
			task.deliverables = [{ kind: "file", title: "x", path: bad }];
			await expect(h.svc.deliverablePath(id, "t1", 0)).rejects.toThrow(/no longer in the workspace/);
		}
	});
});

describe("events and status", () => {
	it("emits the full project after changes and throttles bursts", async () => {
		vi.useFakeTimers();
		try {
			h.extra = { throttleMs: 100 };
			h.build();
			const p = await h.svc.create({ title: "X", brief: "Y" });
			await vi.advanceTimersByTimeAsync(0);
			const first = h.events.length;
			expect(first).toBeGreaterThanOrEqual(1);
			expect(h.events[0]!.id).toBe(p.id);
			await h.svc.proposePlan(p.id, "n", [t("t1", "Design")]);
			await vi.advanceTimersByTimeAsync(0);
			await h.svc.savePlan(p.id, [{ id: "a", title: "A", brief: "b", assignee: DES, dependsOn: [] }]);
			await vi.advanceTimersByTimeAsync(0);
			expect(h.events.length).toBe(first); // held back inside the 100 ms window
			await vi.advanceTimersByTimeAsync(150);
			expect(h.events.length).toBe(first + 1);
			expect(h.events.at(-1)!.tasks[0]!.id).toBe("a");
		} finally {
			vi.useRealTimers();
		}
	});

	it("describes projects for SuperDot and the briefing", async () => {
		const id = await h.running([t("t1", "Engineering"), t("t2", "human", { dependsOn: ["t1"] })]);
		await h.waitCalls(1);
		const text = await h.svc.statusText(id);
		expect(text).toContain("Add SSO");
		expect(text).toContain("t1 Task t1 (Engineering): running");
		expect(text).toContain("waiting on t1");
		expect(await h.svc.statusText("prj_nothing0000")).toContain("No project");
		expect(await h.svc.activeProjectsLine()).toBe("Active projects: Add SSO (0 of 2 done)");
		h.reply("[DONE] ok");
		await vi.waitFor(async () =>
			expect(await h.svc.activeProjectsLine()).toBe("Active projects: Add SSO (1 of 2 done, 1 waiting for you)"),
		);
		expect(await h.svc.teamDirectory()).toContain("- Engineering (engineering)");
	});
});
