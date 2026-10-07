// @vitest-environment jsdom
import type { OrgProject, OrgTask } from "@shared/organisation";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	project: vi.fn(),
	savePlan: vi.fn(),
	approve: vi.fn(),
	replan: vi.fn(),
	pause: vi.fn(),
	resume: vi.fn(),
	cancel: vi.fn(),
	deleteProject: vi.fn(),
	reviewTask: vi.fn(),
	completeTask: vi.fn(),
	answerTask: vi.fn(),
	retryTask: vi.fn(),
	skipTask: vi.fn(),
	openDeliverable: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
	api: { org: m, app: { openExternal: vi.fn() }, on: vi.fn(() => () => undefined) },
	errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));
vi.mock("@/features/chats/Markdown", () => ({ Markdown: ({ text }: { text: string }) => <div>{text}</div> }));

import { useDots } from "@/stores/dots";
import { useOrganisation } from "@/stores/organisation";
import { A, B, DOMAINS, DOTS, ORG, project, SKILLS, TEMPLATES, task } from "./fixtures";
import { OrganisationScreen } from "./OrganisationScreen";

beforeAll(() => {
	class RO {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	(window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
	Element.prototype.scrollIntoView = () => {};
	Element.prototype.hasPointerCapture = () => false;
	Element.prototype.releasePointerCapture = () => {};
});

function show(p: OrgProject) {
	useOrganisation.setState({ byId: { [p.id]: p } });
	m.project.mockResolvedValue(p);
	return render(<OrganisationScreen sub={p.id} />);
}

beforeEach(() => {
	for (const f of Object.values(m)) f.mockReset();
	for (const f of Object.values(m)) f.mockResolvedValue(undefined);
	m.savePlan.mockImplementation(async () => project({ status: "awaiting-approval", tasks: PLAN }));
	useDots.setState({ dots: DOTS, statuses: {}, loaded: true });
	useOrganisation.setState({
		org: ORG,
		templates: TEMPLATES,
		domains: DOMAINS,
		catalogLoaded: true,
		projects: [],
		byId: {},
		skills: SKILLS,
		loaded: true,
		error: null,
		welcome: false,
	});
	window.location.hash = "";
});
afterEach(cleanup);

async function choose(label: string, option: string) {
	fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
	fireEvent.click(await screen.findByRole("option", { name: new RegExp(option) }));
}

const PLAN: OrgTask[] = [
	task("t1", { title: "Design the flow", assignee: A }),
	task("t2", { title: "Build it", assignee: A, dependsOn: ["t1"], reviewer: B }),
];

describe("planning", () => {
	it("shows the planning skeleton until the plan arrives", () => {
		show(project({ status: "planning" }));
		expect(screen.getAllByText("SuperDot is planning…").length).toBeGreaterThan(0);
		expect(screen.getAllByTestId("plan-skeleton-row")).toHaveLength(4);
		expect(screen.queryByText("Review the plan")).toBeNull();
	});

	it("swaps to the plan editor when the project event arrives", async () => {
		show(project({ status: "planning" }));
		await act(async () => {});
		const next = project({ status: "awaiting-approval", tasks: PLAN, plannerNote: "Two steps." });
		m.project.mockResolvedValue(next);
		useOrganisation.getState().setProject(next);
		return waitFor(() => expect(screen.getByText("Review the plan")).toBeTruthy());
	});
});

describe("plan editor", () => {
	const plan = () => project({ status: "awaiting-approval", plannerNote: "I split it in two.", tasks: PLAN });

	it("shows the planner note and the tasks", () => {
		show(plan());
		expect(screen.getByText("I split it in two.")).toBeTruthy();
		expect((screen.getByLabelText("Title", { selector: "#pt-title-t1" }) as HTMLInputElement).value).toBe(
			"Design the flow",
		);
		expect(screen.getAllByRole("listitem", { name: /^Task \d/ })).toHaveLength(2);
	});

	it("adds, edits, moves and removes tasks", () => {
		show(plan());
		fireEvent.click(screen.getByRole("button", { name: "Add task" }));
		const rows = () => screen.getAllByRole("listitem", { name: /^Task \d/ });
		expect(rows()).toHaveLength(3);
		fireEvent.change(document.querySelector("#pt-title-t3") as HTMLInputElement, { target: { value: "Write docs" } });
		fireEvent.change(document.querySelector("#pt-brief-t3") as HTMLTextAreaElement, { target: { value: "Docs done" } });
		// Move the new task to the top.
		fireEvent.click(within(rows()[2]!).getByRole("button", { name: "Move up" }));
		fireEvent.click(within(rows()[1]!).getByRole("button", { name: "Move up" }));
		expect((within(rows()[0]!).getByLabelText("Title") as HTMLInputElement).value).toBe("Write docs");
		expect((within(rows()[0]!).getByRole("button", { name: "Move up" }) as HTMLButtonElement).disabled).toBe(true);
		// Remove the task that t2 depends on: the dependency is dropped too.
		fireEvent.click(within(rows()[1]!).getByRole("button", { name: "Remove task" }));
		expect(rows()).toHaveLength(2);
		expect((within(rows()[1]!).getByRole("checkbox", { name: "Write docs" }) as HTMLInputElement).checked).toBe(false);
		expect(screen.queryByText(/depends on "t1"/)).toBeNull();
	});

	it("changes assignee, reviewer and dependencies", async () => {
		show(plan());
		await choose("Assignee for task 1", "Security");
		await choose("Reviewer for task 1", "Me");
		fireEvent.click(
			within(screen.getByRole("listitem", { name: "Task 1" })).getByRole("checkbox", { name: "Build it" }),
		);
		// t1 now depends on t2, and t2 depends on t1: a circle.
		expect(screen.getByText("The tasks depend on each other in a circle.")).toBeTruthy();
		fireEvent.click(
			within(screen.getByRole("listitem", { name: "Task 1" })).getByRole("checkbox", { name: "Build it" }),
		);
		expect(screen.queryByText("The tasks depend on each other in a circle.")).toBeNull();
		await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => expect(m.savePlan).toHaveBeenCalled());
		const sent = m.savePlan.mock.calls[0]![1] as Array<Record<string, unknown>>;
		expect(sent[0]).toMatchObject({ id: "t1", assignee: B, reviewer: "human" });
		expect(sent[1]).toMatchObject({ id: "t2", dependsOn: ["t1"], reviewer: B });
	});

	it("shows live validation messages and blocks approval", () => {
		show(plan());
		fireEvent.change(document.querySelector("#pt-title-t1") as HTMLInputElement, { target: { value: "" } });
		expect(screen.getByText("Task t1 has no title.")).toBeTruthy();
		expect((screen.getByRole("button", { name: "Approve and start" }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText("Fix 1 problem to continue.")).toBeTruthy();
		fireEvent.change(document.querySelector("#pt-title-t1") as HTMLInputElement, { target: { value: "Back" } });
		expect(screen.queryByText("Task t1 has no title.")).toBeNull();
		expect((screen.getByRole("button", { name: "Approve and start" }) as HTMLButtonElement).disabled).toBe(false);
	});

	it("flags an empty plan and a reviewer who is also the assignee", async () => {
		show(plan());
		await choose("Reviewer for task 2", "Engineering");
		expect(screen.getByText("Task t2: a task can't be reviewed by its own assignee.")).toBeTruthy();
		for (const b of screen.getAllByRole("button", { name: "Remove task" })) fireEvent.click(b);
		expect(screen.getByText("The plan has no tasks.")).toBeTruthy();
	});

	it("approves an unchanged plan without saving", async () => {
		show(plan());
		fireEvent.click(screen.getByRole("button", { name: "Approve and start" }));
		await waitFor(() => expect(m.approve).toHaveBeenCalledWith("prj_1"));
		expect(m.savePlan).not.toHaveBeenCalled();
	});

	it("saves edits first, then approves", async () => {
		show(plan());
		fireEvent.change(document.querySelector("#pt-title-t1") as HTMLInputElement, { target: { value: "New title" } });
		fireEvent.click(screen.getByRole("button", { name: "Approve and start" }));
		await waitFor(() => expect(m.approve).toHaveBeenCalled());
		expect(m.savePlan).toHaveBeenCalledTimes(1);
		expect(m.savePlan.mock.invocationCallOrder[0]!).toBeLessThan(m.approve.mock.invocationCallOrder[0]!);
	});

	it("asks SuperDot to replan with feedback", async () => {
		show(plan());
		fireEvent.click(screen.getByRole("button", { name: "Ask SuperDot to replan" }));
		fireEvent.change(screen.getByLabelText("What should change?"), { target: { value: "Add a security check" } });
		fireEvent.click(screen.getByRole("button", { name: "Send to SuperDot" }));
		await waitFor(() => expect(m.replan).toHaveBeenCalledWith("prj_1", "Add a security check"));
	});

	it("shows a failed save as a message, not a crash", async () => {
		m.approve.mockRejectedValue(new Error("Not allowed"));
		show(plan());
		fireEvent.click(screen.getByRole("button", { name: "Approve and start" }));
		await waitFor(() => expect(m.approve).toHaveBeenCalled());
		expect(screen.getByText("Review the plan")).toBeTruthy();
	});
});

describe("board", () => {
	const tasks: OrgTask[] = [
		task("t1", { title: "Todo one" }),
		task("t2", { title: "Doing one", status: "running", attempt: 1 }),
		task("t3", { title: "Asking one", status: "needs-input", question: "Which color?" }),
		task("t4", { title: "Reviewing one", status: "review", reviewer: B, attempt: 2 }),
		task("t5", { title: "Done one", status: "done" }),
		task("t6", { title: "Skipped one", status: "skipped" }),
		task("t7", { title: "Broken one", status: "failed", error: "Timed out", dependsOn: ["t1", "t2"] }),
	];
	const col = (name: string) => screen.getByRole("region", { name });

	it("puts tasks in columns by status", () => {
		show(project({ tasks }));
		expect(within(col("To do")).getByText("Todo one")).toBeTruthy();
		expect(within(col("In progress")).getByText("Doing one")).toBeTruthy();
		expect(within(col("In progress")).getByText("Asking one")).toBeTruthy();
		expect(within(col("In review")).getByText("Reviewing one")).toBeTruthy();
		for (const n of ["Done one", "Skipped one", "Broken one"]) expect(within(col("Done")).getByText(n)).toBeTruthy();
	});

	it("shows assignee, dependency count, attempt badge and the failed mark", () => {
		show(project({ tasks }));
		const broken = screen.getByText("Broken one").closest("button")!;
		expect(broken.textContent).toContain("Needs 2 tasks");
		expect(within(broken).getByLabelText("Failed")).toBeTruthy();
		expect(within(screen.getByText("Reviewing one").closest("button")!).getByText("Round 2")).toBeTruthy();
		expect(within(broken).getByText("Engineering")).toBeTruthy();
		expect(within(screen.getByText("Asking one").closest("button")!).getByText("Waiting for you")).toBeTruthy();
	});

	it("toggles to a simple list", () => {
		show(project({ tasks }));
		fireEvent.click(screen.getByRole("radio", { name: "List" }));
		expect(screen.getByTestId("task-list")).toBeTruthy();
		expect(screen.queryByTestId("board")).toBeNull();
		expect(screen.getByText("Todo one")).toBeTruthy();
	});

	it("shows the status note, spend, the summary and the activity newest first", () => {
		show(
			project({
				status: "paused",
				statusNote: "Budget reached",
				budgetUsd: 2,
				tasks,
				summary: "All **done**.",
				log: [
					{ at: "2026-01-01T00:00:00Z", kind: "info", text: "First thing" },
					{ at: "2026-01-02T00:00:00Z", kind: "info", text: "Second thing" },
				],
			}),
		);
		expect(screen.getByText("Budget reached")).toBeTruthy();
		expect(screen.getByText("$1.50 of $2.00")).toBeTruthy();
		expect(screen.getByRole("region", { name: "Summary" }).textContent).toContain("All **done**.");
		const items = within(screen.getByRole("region", { name: "Activity" })).getAllByRole("listitem");
		expect(items[0]!.textContent).toContain("Second thing");
		expect(items[1]!.textContent).toContain("First thing");
	});

	it("pause, resume and cancel", async () => {
		const { unmount } = show(project({ tasks }));
		fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
		await waitFor(() => expect(m.pause).toHaveBeenCalledWith("prj_1"));
		fireEvent.click(screen.getByRole("button", { name: "Cancel project" }));
		expect(m.cancel).not.toHaveBeenCalled();
		fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel project" }));
		await waitFor(() => expect(m.cancel).toHaveBeenCalledWith("prj_1"));
		unmount();
		show(project({ status: "paused", tasks }));
		fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
		await waitFor(() => expect(m.resume).toHaveBeenCalledWith("prj_1"));
	});

	it("deletes a finished project after confirming and goes back", async () => {
		show(project({ status: "done", tasks }));
		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
		await waitFor(() => expect(m.deleteProject).toHaveBeenCalledWith("prj_1"));
		await waitFor(() => expect(window.location.hash).toBe("#/organisation"));
	});

	it("back link returns to the list", () => {
		show(project({ tasks }));
		fireEvent.click(screen.getByRole("button", { name: /All projects/ }));
		expect(window.location.hash).toBe("#/organisation");
	});

	it("loads a project that isn't in the store yet, and shows a retry when that fails", async () => {
		m.project.mockRejectedValueOnce(new Error("nope"));
		render(<OrganisationScreen sub="prj_missing" />);
		expect(await screen.findByText("Organisation isn't available yet")).toBeTruthy();
		m.project.mockResolvedValueOnce(project({ id: "prj_missing", title: "Found it", tasks }));
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(await screen.findByText("Found it")).toBeTruthy();
	});
});

describe("task drawer", () => {
	const open = (p: OrgProject, title: string) => {
		show(p);
		fireEvent.click(screen.getByText(title).closest("button")!);
		return screen.getByRole("dialog");
	};

	it("answers a question for needs-input", async () => {
		const d = open(
			project({ tasks: [task("t1", { title: "Pick", status: "needs-input", question: "Which color?" })] }),
			"Pick",
		);
		expect(within(d).getByText("Which color?")).toBeTruthy();
		expect(within(d).getByText("Brief for t1")).toBeTruthy();
		const send = within(d).getByRole("button", { name: "Send answer" }) as HTMLButtonElement;
		expect(send.disabled).toBe(true);
		fireEvent.change(within(d).getByLabelText("Your answer"), { target: { value: "Blue" } });
		fireEvent.click(send);
		await waitFor(() => expect(m.answerTask).toHaveBeenCalledWith("prj_1", "t1", "Blue"));
	});

	it("approves a human review, and needs a note to ask for changes", async () => {
		const p = project({
			tasks: [
				task("t1", {
					title: "Check",
					status: "review",
					reviewer: "human",
					result: "I did the **thing**",
					reviews: [{ verdict: "changes", note: "Add tests", by: B, at: "2026-01-01T00:00:00Z" }],
					deliverables: [{ kind: "file", title: "report.md", path: "projects/p/t1/report.md" }],
				}),
			],
		});
		const d = open(p, "Check");
		expect(within(d).getByText("I did the **thing**")).toBeTruthy();
		expect(within(d).getByText("Add tests")).toBeTruthy();
		expect(within(d).getByText("Changes asked for")).toBeTruthy();
		const changes = within(d).getByRole("button", { name: "Request changes" }) as HTMLButtonElement;
		expect(changes.disabled).toBe(true);
		fireEvent.change(within(d).getByLabelText(/Note/), { target: { value: "Please fix the intro" } });
		fireEvent.click(changes);
		await waitFor(() => expect(m.reviewTask).toHaveBeenCalledWith("prj_1", "t1", "changes", "Please fix the intro"));
		fireEvent.click(within(d).getByRole("button", { name: "Approve" }));
		await waitFor(() => expect(m.reviewTask).toHaveBeenCalledWith("prj_1", "t1", "approved", "Please fix the intro"));
		fireEvent.click(within(d).getByRole("button", { name: "Open report.md" }));
		await waitFor(() => expect(m.openDeliverable).toHaveBeenCalledWith("prj_1", "t1", 0));
	});

	it("lets the user mark a human task done", async () => {
		const d = open(project({ tasks: [task("t1", { title: "Sign it", assignee: "human" })] }), "Sign it");
		expect(within(d).getByText("Me")).toBeTruthy();
		fireEvent.click(within(d).getByRole("button", { name: "I did this" }));
		await waitFor(() => expect(m.completeTask).toHaveBeenCalledWith("prj_1", "t1", undefined));
	});

	it("keeps 'I did this' off until the earlier tasks are done", () => {
		const d = open(
			project({
				tasks: [
					task("t0", { title: "First", status: "running" }),
					task("t1", { title: "Sign it", assignee: "human", dependsOn: ["t0"] }),
				],
			}),
			"Sign it",
		);
		expect((within(d).getByRole("button", { name: "I did this" }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("retries or skips a failed task", async () => {
		const d = open(
			project({ tasks: [task("t1", { title: "Boom", status: "failed", error: "It timed out" })] }),
			"Boom",
		);
		expect(within(d).getByText("It timed out")).toBeTruthy();
		fireEvent.click(within(d).getByRole("button", { name: "Retry" }));
		await waitFor(() => expect(m.retryTask).toHaveBeenCalledWith("prj_1", "t1"));
		fireEvent.click(within(d).getByRole("button", { name: "Skip" }));
		await waitFor(() => expect(m.skipTask).toHaveBeenCalledWith("prj_1", "t1"));
	});

	it("shows deliverables of every kind and no actions on a done task", async () => {
		const d = open(
			project({
				tasks: [
					task("t1", {
						title: "Ship",
						status: "done",
						deliverables: [
							{ kind: "file", title: "a.txt", path: "a.txt" },
							{ kind: "link", title: "PR", url: "https://example.com/pr" },
							{ kind: "text", title: "Note", text: "Inline text" },
						],
					}),
				],
			}),
			"Ship",
		);
		expect(within(d).getByText("a.txt")).toBeTruthy();
		expect(within(d).getByText("Inline text")).toBeTruthy();
		expect(within(d).getAllByRole("button", { name: /^Open / })).toHaveLength(2);
		expect(within(d).queryByRole("button", { name: "Retry" })).toBeNull();
		expect(within(d).queryByRole("button", { name: "Send answer" })).toBeNull();
	});

	it("follows live updates of the open task", async () => {
		const p = project({ tasks: [task("t1", { title: "Live", status: "running" })] });
		const d = open(p, "Live");
		await act(async () => {});
		expect(within(d).getByText("Working on it")).toBeTruthy();
		const done = project({ tasks: [task("t1", { title: "Live", status: "done" })] });
		m.project.mockResolvedValue(done);
		useOrganisation.getState().setProject(done);
		return waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Done")).toBeTruthy());
	});
});
