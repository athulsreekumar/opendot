import { describe, expect, it } from "vitest";
import type { OrgProject, OrgTask } from "../../shared/organisation";
import { briefingPrompt } from "../briefing/prompt";
import {
	activeProjectsLine,
	answerPrompt,
	fallbackSummary,
	plannerPrompt,
	reviewPrompt,
	revisionPrompt,
	taskPrompt,
} from "./project-prompts";

const task = (over: Partial<OrgTask> = {}): OrgTask => ({
	id: "t2",
	title: "Build login",
	brief: "Implement it. Done means tests pass.",
	assignee: "dot_engineer1",
	dependsOn: ["t1"],
	status: "pending",
	attempt: 1,
	reviews: [],
	deliverables: [],
	...over,
});
const project = (): OrgProject => ({
	id: "prj_abc123456789",
	title: "Add SSO",
	brief: "Single sign-on",
	status: "running",
	createdAt: "",
	updatedAt: "",
	tasks: [task({ id: "t1", title: "Research" }), task()],
	concurrency: 3,
	maxRevisions: 2,
	spentUsd: 0,
	log: [],
});

describe("prompts", () => {
	it("task prompt follows the protocol", () => {
		const p = project();
		const text = taskPrompt(p, p.tasks[1]!, [
			{ title: "Research", assigneeName: "Design", result: "x".repeat(2000), deliverables: ["notes.md"] },
		]);
		expect(text).toContain('Task from the project "Add SSO" (task t2 of 2): Build login');
		expect(text).toContain("Project request: Single sign-on");
		expect(text).toContain('What to do and what "done" means: Implement it.');
		expect(text).toContain("## Research (Design)");
		expect(text).toContain("Files: notes.md");
		expect(text).not.toContain("x".repeat(1600));
		expect(text).toContain("projects/prj_abc123456789/t2/");
		expect(text).toContain("[DONE]");
		expect(text).toContain("[BLOCKED]");
	});

	it("revision, answer and review prompts carry what the Dot needs", () => {
		const p = project();
		expect(revisionPrompt(p, p.tasks[1]!, "1. Add tests")).toContain("1. Add tests");
		expect(answerPrompt(p, p.tasks[1]!, "Okta")).toContain("Okta");
		const r = reviewPrompt(
			p,
			{ ...p.tasks[1]!, result: "built it" },
			"Engineering",
			["a.md"],
			[{ title: "a.md", text: "BODY" }],
		);
		expect(r).toContain("built it");
		expect(r).toContain("Files: a.md");
		expect(r).toContain("BODY");
		expect(r).toContain("[APPROVE]");
		expect(r).toContain("[CHANGES]");
	});

	it("planner prompt lists the team, the rules and the feedback", () => {
		const text = plannerPrompt(
			project(),
			[{ name: "Engineering", domain: "engineering", skills: ["Ship a change"], about: "Builds software" }],
			{ engineering: ["security"] },
			"fewer tasks please",
		);
		expect(text).toContain("prj_abc123456789");
		expect(text).toContain("- Engineering (engineering), skills: Ship a change");
		expect(text).toContain("usually reviewed by: security");
		expect(text).toContain("3 to 12 tasks");
		expect(text).toContain("propose_plan exactly once");
		expect(text).toContain("fewer tasks please");
	});

	it("user-facing text has no em dashes", () => {
		const p = project();
		const all = [
			taskPrompt(p, p.tasks[1]!, []),
			plannerPrompt(p, [], {}),
			fallbackSummary(p, () => "X"),
			activeProjectsLine([{ title: "T", done: 1, total: 2, waiting: 1 }]) ?? "",
		].join("\n");
		expect(all).not.toContain("—");
	});

	it("the briefing gets one extra line only when projects are active", () => {
		const base = { dateText: "Tue 7 Oct", dotNames: ["Inbox"], instructions: "" };
		const without = briefingPrompt(base);
		expect(without).not.toContain("Active projects");
		const line = activeProjectsLine([{ title: "Add SSO", done: 3, total: 7, waiting: 1 }]);
		expect(line).toBe("Active projects: Add SSO (3 of 7 done, 1 waiting for you)");
		const withLine = briefingPrompt({ ...base, activeProjects: line });
		expect(withLine).toContain("Active projects: Add SSO (3 of 7 done, 1 waiting for you)");
		expect(withLine.split("\n").length).toBe(without.split("\n").length + 1);
		expect(activeProjectsLine([])).toBeUndefined();
	});
});
