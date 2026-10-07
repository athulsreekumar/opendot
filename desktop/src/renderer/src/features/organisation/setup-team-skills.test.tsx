// @vitest-environment jsdom
import type { OrgProjectSummary, Skill } from "@shared/organisation";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
	state: vi.fn(),
	catalog: vi.fn(),
	setup: vi.fn(),
	addMember: vi.fn(),
	removeMember: vi.fn(),
	setMemberSkills: vi.fn(),
	skills: vi.fn(),
	skill: vi.fn(),
	saveSkill: vi.fn(),
	deleteSkill: vi.fn(),
	projects: vi.fn(),
	project: vi.fn(),
	createProject: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
	api: { org: m, app: { openExternal: vi.fn() }, on: vi.fn(() => () => undefined) },
	errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));
vi.mock("@/features/chats/Markdown", () => ({ Markdown: ({ text }: { text: string }) => <div>{text}</div> }));

import { NavRail } from "@/app/NavRail";
import { MessageBubble } from "@/features/chats/MessageBubble";
import { useApprovals } from "@/stores/approvals";
import { useChat } from "@/stores/chat";
import { useDots } from "@/stores/dots";
import { useOrganisation } from "@/stores/organisation";
import { A, B, DOMAINS, DOTS, NO_ORG, ORG, SKILLS, TEMPLATES } from "./fixtures";
import { OrganisationScreen } from "./OrganisationScreen";
import { OrgUpdateCard } from "./OrgUpdateCard";

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

function reset(over: Partial<ReturnType<typeof useOrganisation.getState>> = {}) {
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
		...over,
	});
}

beforeEach(() => {
	for (const f of Object.values(m)) f.mockReset();
	m.catalog.mockResolvedValue({ templates: TEMPLATES, domains: DOMAINS });
	m.skills.mockResolvedValue(SKILLS);
	m.state.mockResolvedValue(ORG);
	m.projects.mockResolvedValue([]);
	useDots.setState({ dots: DOTS, statuses: {}, loaded: true });
	useApprovals.setState({ pending: [], history: [], historyLoaded: false });
	window.location.hash = "";
	reset();
});
afterEach(cleanup);

async function choose(label: string, option: string) {
	const trigger = screen.getByRole("combobox", { name: label });
	fireEvent.keyDown(trigger, { key: "Enter" });
	fireEvent.click(await screen.findByRole("option", { name: new RegExp(option) }));
}

describe("set-up", () => {
	beforeEach(() => reset({ org: NO_ORG }));

	it("shows the template cards and creates the team from the chosen one", async () => {
		m.setup.mockResolvedValue(ORG);
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen />);
		expect(screen.getByText("Build your team")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /Everything/ }));
		fireEvent.click(screen.getByRole("button", { name: "Create my team" }));
		await waitFor(() => expect(m.setup).toHaveBeenCalledWith({ templateId: "full" }));
		await waitFor(() => expect(useOrganisation.getState().welcome).toBe(true));
	});

	it("lets the user choose domains", async () => {
		m.setup.mockResolvedValue(ORG);
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen />);
		fireEvent.click(screen.getByRole("button", { name: "Choose domains" }));
		fireEvent.click(screen.getByRole("checkbox", { name: /Security/ }));
		fireEvent.click(screen.getByRole("button", { name: "Create my team" }));
		await waitFor(() => expect(m.setup).toHaveBeenCalledWith({ templateId: "startup", domains: ["engineering"] }));
	});

	it("loads the catalog when it is not there yet", async () => {
		reset({ org: NO_ORG, catalogLoaded: false, templates: [], domains: [] });
		render(<OrganisationScreen />);
		expect(await screen.findByText("Startup")).toBeTruthy();
	});
});

describe("unavailable", () => {
	it("shows a friendly panel with Retry when the state can't load", async () => {
		reset({ org: null, loaded: true, error: "not implemented" });
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen />);
		expect(screen.getByText("Organisation isn't available yet")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await waitFor(() => expect(m.state).toHaveBeenCalled());
		await waitFor(() => expect(screen.queryByText("Organisation isn't available yet")).toBeNull());
	});

	it("the store records the failure without throwing", async () => {
		reset({ org: null, loaded: false });
		m.state.mockRejectedValue(new Error("not built yet"));
		await useOrganisation.getState().load();
		expect(useOrganisation.getState().error).toBe("not built yet");
		expect(useOrganisation.getState().loaded).toBe(true);
	});
});

const SUMMARY: OrgProjectSummary = {
	id: "prj_1",
	title: "Add sign-in",
	status: "running",
	updatedAt: new Date().toISOString(),
	taskCount: 7,
	doneCount: 3,
	attention: 2,
	spentUsd: 1.5,
};

describe("projects", () => {
	it("shows the empty state", () => {
		render(<OrganisationScreen />);
		expect(screen.getByText("No projects yet")).toBeTruthy();
	});

	it("lists project cards with status, progress, attention and spend", () => {
		reset({ projects: [SUMMARY] });
		render(<OrganisationScreen />);
		expect(screen.getByText("Add sign-in")).toBeTruthy();
		expect(screen.getByText("3 of 7")).toBeTruthy();
		expect(screen.getByText("Running")).toBeTruthy();
		expect(screen.getByLabelText("2 waiting for you")).toBeTruthy();
		expect(screen.getByText("$1.50 spent")).toBeTruthy();
		fireEvent.click(screen.getByText("Add sign-in"));
		expect(window.location.hash).toBe("#/organisation/prj_1");
	});

	it("shows the welcome hint after set-up", () => {
		reset({ welcome: true });
		render(<OrganisationScreen />);
		expect(screen.getByText("Your team is ready")).toBeTruthy();
	});

	it("creates a project from the dialog and opens it", async () => {
		m.createProject.mockResolvedValue({ id: "prj_9", title: "X", status: "planning", tasks: [], log: [], spentUsd: 0 });
		render(<OrganisationScreen />);
		fireEvent.click(screen.getAllByRole("button", { name: "New project" })[0]!);
		const create = screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement;
		expect(create.disabled).toBe(true);
		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Launch" } });
		fireEvent.change(screen.getByLabelText("What do you need?"), { target: { value: "Launch it" } });
		fireEvent.change(screen.getByLabelText(/Budget/), { target: { value: "5" } });
		fireEvent.click(screen.getByRole("button", { name: "Create project" }));
		await waitFor(() =>
			expect(m.createProject).toHaveBeenCalledWith({ title: "Launch", brief: "Launch it", budgetUsd: 5 }),
		);
		await waitFor(() => expect(window.location.hash).toBe("#/organisation/prj_9"));
	});

	it("rejects a bad budget", () => {
		render(<OrganisationScreen />);
		fireEvent.click(screen.getAllByRole("button", { name: "New project" })[0]!);
		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Launch" } });
		fireEvent.change(screen.getByLabelText("What do you need?"), { target: { value: "Launch it" } });
		fireEvent.change(screen.getByLabelText(/Budget/), { target: { value: "abc" } });
		expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(true);
	});
});

describe("team", () => {
	it("shows members with skills and opens their chat", () => {
		render(<OrganisationScreen sub="team" />);
		const card = screen.getByRole("article", { name: "Engineering" });
		expect(within(card).getByText("Ship a change")).toBeTruthy();
		fireEvent.click(within(card).getByRole("button", { name: "Open chat" }));
		expect(window.location.hash).toBe(`#/chats/${A}`);
	});

	it("adds a domain that is not on the team yet", async () => {
		m.addMember.mockResolvedValue({ dotId: "dot_hr", domain: "hr", skillIds: [] });
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen sub="team" />);
		fireEvent.click(screen.getByRole("button", { name: "Add a domain" }));
		await choose("Department", "HR");
		fireEvent.click(screen.getByRole("button", { name: "Add to team" }));
		await waitFor(() => expect(m.addMember).toHaveBeenCalledWith({ domain: "hr" }));
	});

	it("can adopt an existing Dot", async () => {
		useDots.setState({ dots: [...DOTS, { ...DOTS[0]!, id: "dot_x" as typeof A, name: "Helper" }] });
		m.addMember.mockResolvedValue({ dotId: "dot_x", domain: "hr", skillIds: [] });
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen sub="team" />);
		fireEvent.click(screen.getByRole("button", { name: "Add a domain" }));
		await choose("Department", "HR");
		fireEvent.click(screen.getByRole("checkbox", { name: "Use an existing Dot" }));
		await choose("Existing Dot", "Helper");
		fireEvent.click(screen.getByRole("button", { name: "Add to team" }));
		await waitFor(() => expect(m.addMember).toHaveBeenCalledWith({ domain: "hr", dotId: "dot_x" }));
	});

	it("edits a member's skills", async () => {
		m.setMemberSkills.mockResolvedValue(undefined);
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen sub="team" />);
		fireEvent.click(
			within(screen.getByRole("article", { name: "Security" })).getByRole("button", { name: "Edit skills" }),
		);
		fireEvent.click(screen.getByRole("checkbox", { name: "My playbook" }));
		fireEvent.click(screen.getByRole("button", { name: "Save skills" }));
		await waitFor(() => expect(m.setMemberSkills).toHaveBeenCalledWith(B, ["user:mine"]));
	});

	it("removes a member after confirming", async () => {
		m.removeMember.mockResolvedValue(undefined);
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen sub="team" />);
		fireEvent.click(within(screen.getByRole("article", { name: "Security" })).getByRole("button", { name: "Remove" }));
		expect(m.removeMember).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Remove from organisation" }));
		await waitFor(() => expect(m.removeMember).toHaveBeenCalledWith(B));
	});
});

const BUILTIN: Skill = { ...SKILLS[0]!, body: "# Steps", updatedAt: "2026-01-01T00:00:00Z" };
const MINE: Skill = { ...SKILLS[1]!, body: "my body", updatedAt: "2026-01-01T00:00:00Z" };

describe("skills", () => {
	it("groups by domain, marks built-ins and searches", () => {
		render(<OrganisationScreen sub="skills" />);
		expect(screen.getByRole("region", { name: "Engineering" })).toBeTruthy();
		expect(screen.getByRole("region", { name: "Shared" })).toBeTruthy();
		expect(screen.getAllByText("Built-in")).toHaveLength(2);
		fireEvent.change(screen.getByLabelText("Search skills"), { target: { value: "playbook" } });
		expect(screen.queryByText("Ship a change")).toBeNull();
		expect(screen.getByText("My playbook")).toBeTruthy();
	});

	it("shows a built-in as read-only and duplicates it", async () => {
		m.skill.mockImplementation(async (id: string) =>
			id === "builtin:ship" ? BUILTIN : { ...BUILTIN, id: "user:copy", builtin: false, name: "Ship a change (copy)" },
		);
		m.saveSkill.mockResolvedValue({ ...BUILTIN, id: "user:copy", builtin: false, name: "Ship a change (copy)" });
		render(<OrganisationScreen sub="skills" />);
		fireEvent.click(screen.getByText("Ship a change"));
		expect(await screen.findByText(/can't be changed/)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Save skill" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Duplicate to edit" }));
		await waitFor(() =>
			expect(m.saveSkill).toHaveBeenCalledWith({
				name: "Ship a change (copy)",
				description: "How we ship",
				domain: "engineering",
				body: "# Steps",
			}),
		);
		expect(await screen.findByRole("button", { name: "Save skill" })).toBeTruthy();
	});

	it("edits and saves a user skill", async () => {
		m.skill.mockResolvedValue(MINE);
		m.saveSkill.mockResolvedValue(MINE);
		render(<OrganisationScreen sub="skills" />);
		fireEvent.click(screen.getByText("My playbook"));
		const name = (await screen.findByLabelText("Name")) as HTMLInputElement;
		expect(name.value).toBe("My playbook");
		fireEvent.change(name, { target: { value: "Renamed" } });
		fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
		await waitFor(() =>
			expect(m.saveSkill).toHaveBeenCalledWith({
				id: "user:mine",
				name: "Renamed",
				description: "Mine",
				domain: "security",
				body: "my body",
			}),
		);
	});

	it("deletes a user skill after confirming", async () => {
		m.skill.mockResolvedValue(MINE);
		m.deleteSkill.mockResolvedValue(undefined);
		m.state.mockResolvedValue(ORG);
		render(<OrganisationScreen sub="skills" />);
		fireEvent.click(screen.getByText("My playbook"));
		fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
		expect(m.deleteSkill).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
		await waitFor(() => expect(m.deleteSkill).toHaveBeenCalledWith("user:mine"));
	});

	it("creates a new skill", async () => {
		m.saveSkill.mockResolvedValue(MINE);
		render(<OrganisationScreen sub="skills" />);
		fireEvent.click(screen.getByRole("button", { name: "New skill" }));
		fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "New one" } });
		fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Does a thing" } });
		fireEvent.change(screen.getByLabelText(/Playbook/), { target: { value: "Steps" } });
		fireEvent.click(screen.getByRole("button", { name: "Save skill" }));
		await waitFor(() =>
			expect(m.saveSkill).toHaveBeenCalledWith({ name: "New one", description: "Does a thing", body: "Steps" }),
		);
	});
});

describe("navigation and chat", () => {
	it("NavRail shows the Organisation item with the attention badge", () => {
		reset({ projects: [SUMMARY, { ...SUMMARY, id: "prj_2", attention: 1 }] });
		render(<NavRail route={{ name: "organisation" }} />);
		const btn = screen.getByRole("button", { name: "Organisation" });
		expect(btn.getAttribute("aria-current")).toBe("page");
		expect(btn.parentElement?.textContent).toContain("3");
		fireEvent.click(btn);
		expect(window.location.hash).toBe("#/organisation");
	});

	it("NavRail has no badge when nothing is waiting", () => {
		reset({ projects: [{ ...SUMMARY, attention: 0 }] });
		render(<NavRail route={{ name: "chats" }} />);
		expect(screen.getByRole("button", { name: "Organisation" }).parentElement?.textContent).toBe("");
	});

	it("the orgUpdate card opens the project", () => {
		render(
			<OrgUpdateCard
				update={{ projectId: "prj_1", title: "Add sign-in", kind: "plan-ready", text: "The plan is ready." }}
			/>,
		);
		expect(screen.getByText("Add sign-in")).toBeTruthy();
		expect(screen.getByText("The plan is ready.")).toBeTruthy();
		expect(screen.getByText("Plan ready")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Open project" }));
		expect(window.location.hash).toBe("#/organisation/prj_1");
	});

	it("MessageBubble renders an orgUpdate message as the card", () => {
		useChat.setState({
			byDot: {
				dot_super: {
					byId: {
						m1: {
							id: "m1",
							dotId: "dot_super",
							role: "assistant",
							text: "",
							createdAt: "2026-01-01T00:00:00Z",
							toolCalls: [],
							streaming: false,
							orgUpdate: { projectId: "prj_1", title: "Add sign-in", kind: "done", text: "Finished." },
						},
					},
					order: ["m1"],
					loaded: true,
				},
			} as never,
		});
		render(
			<MessageBubble
				dotId="dot_super"
				meta={{ id: "m1", grouped: false, followedByAssistant: false, isLastAssistant: true }}
			/>,
		);
		expect(screen.getByTestId("org-update-card")).toBeTruthy();
		expect(screen.getByText("Finished.")).toBeTruthy();
	});

	it("store: org:project events update the summary list", () => {
		act(() => {
			useOrganisation.getState().setProject({
				id: "prj_5",
				title: "Five",
				brief: "",
				status: "awaiting-approval",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-02T00:00:00Z",
				tasks: [],
				concurrency: 3,
				maxRevisions: 2,
				spentUsd: 0,
				log: [],
			});
		});
		expect(useOrganisation.getState().projects[0]).toMatchObject({ id: "prj_5", attention: 1 });
	});
});
