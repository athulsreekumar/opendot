import { describe, expect, it } from "vitest";
import {
	blockedByFailure,
	type OrgTask,
	type OrgTaskInput,
	parseReviewReply,
	parseTaskReply,
	projectAttention,
	readyTaskIds,
	validatePlan,
} from "./organisation";

const A = "dot_aaaaaaaa" as const;
const B = "dot_bbbbbbbb" as const;
const known = (id: string) => id === A || id === B;
const t = (id: string, extra: Partial<OrgTaskInput> = {}): OrgTaskInput => ({
	id,
	title: `Task ${id}`,
	brief: "Do it",
	assignee: A,
	dependsOn: [],
	...extra,
});
const task = (id: string, status: OrgTask["status"], extra: Partial<OrgTask> = {}): OrgTask => ({
	...t(id),
	status,
	attempt: 0,
	reviews: [],
	deliverables: [],
	...extra,
});

describe("validatePlan", () => {
	it("accepts a good plan", () => {
		expect(validatePlan([t("t1"), t("t2", { dependsOn: ["t1"], assignee: B, reviewer: A })], known)).toEqual([]);
	});
	it("reports empty, duplicate, unknown, self and cyclic problems in plain words", () => {
		expect(validatePlan([], known)[0]!.message).toMatch(/no tasks/);
		expect(validatePlan([t("t1"), t("t1")], known).some((p) => /twice/.test(p.message))).toBe(true);
		expect(validatePlan([t("t1", { assignee: "dot_zzzzzzzz" })], known)[0]!.message).toMatch(/isn't on the team/);
		expect(validatePlan([t("t1", { dependsOn: ["t1"] })], known)[0]!.message).toMatch(/itself/);
		expect(validatePlan([t("t1", { dependsOn: ["nope"] })], known)[0]!.message).toMatch(/doesn't exist/);
		expect(validatePlan([t("t1", { dependsOn: ["t2"] }), t("t2", { dependsOn: ["t1"] })], known)[0]!.message).toMatch(
			/circle/,
		);
		expect(validatePlan([t("t1", { reviewer: A })], known)[0]!.message).toMatch(/own assignee/);
	});
	it("allows human assignees and reviewers", () => {
		expect(validatePlan([t("t1", { assignee: "human" }), t("t2", { reviewer: "human" })], known)).toEqual([]);
	});
});

describe("readiness", () => {
	it("starts tasks whose dependencies are done or skipped", () => {
		const tasks = [
			task("t1", "done"),
			task("t2", "pending", { dependsOn: ["t1"] }),
			task("t3", "pending", { dependsOn: ["t2"] }),
		];
		expect(readyTaskIds(tasks)).toEqual(["t2"]);
		expect(readyTaskIds([task("t1", "skipped"), task("t2", "pending", { dependsOn: ["t1"] })])).toEqual(["t2"]);
		expect(readyTaskIds([task("t1", "review"), task("t2", "pending", { dependsOn: ["t1"] })])).toEqual([]);
	});
	it("finds tasks that can never start", () => {
		expect(blockedByFailure([task("t1", "failed"), task("t2", "pending", { dependsOn: ["t1"] })])).toEqual(["t2"]);
	});
});

describe("projectAttention", () => {
	it("counts what only the user can move", () => {
		expect(projectAttention({ status: "awaiting-approval", tasks: [] })).toBe(1);
		expect(projectAttention({ status: "planning", tasks: [] })).toBe(0);
		expect(
			projectAttention({
				status: "running",
				tasks: [
					task("t1", "needs-input"),
					task("t2", "review", { reviewer: "human" }),
					task("t3", "review", { reviewer: B }),
					task("t4", "pending", { assignee: "human" }),
					task("t5", "pending", { assignee: "human", dependsOn: ["t3"] }),
				],
			}),
		).toBe(3);
	});
});

describe("reply protocols", () => {
	it("parses assignee replies", () => {
		expect(parseTaskReply("[BLOCKED] Which database?")).toEqual({ kind: "blocked", text: "Which database?" });
		expect(parseTaskReply("[DONE] All finished.")).toEqual({ kind: "done", text: "All finished." });
		expect(parseTaskReply("Finished the work.").kind).toBe("done");
	});
	it("parses reviewer replies and treats anything else as unclear", () => {
		expect(parseReviewReply("[APPROVE] Looks good")).toEqual({ verdict: "approved", note: "Looks good" });
		expect(parseReviewReply("[CHANGES] Add tests")).toEqual({ verdict: "changes", note: "Add tests" });
		expect(parseReviewReply("Hmm, maybe.").verdict).toBe("unclear");
	});
});
