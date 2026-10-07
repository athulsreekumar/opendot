import { describe, expect, it, vi } from "vitest";
import type { OrgProject } from "../../../shared/organisation";
import { type OrgToolsDeps, organisationExtension } from "./organisation";

type Tool = {
	name: string;
	execute: (id: string, p: never, signal?: AbortSignal) => Promise<{ content: Array<{ text: string }> }>;
};
type Handler = (event: unknown) => Promise<void> | void;

function setup(over: Partial<OrgToolsDeps> = {}) {
	const tools = new Map<string, Tool>();
	const handlers = new Map<string, Handler>();
	const deps: OrgToolsDeps = {
		exists: async () => true,
		team: async () => "Team text",
		create: async (i) => ({ id: "prj_abc123456789", title: i.title }) as OrgProject,
		proposePlan: async () => ({ ok: true, taskCount: 2 }),
		status: async () => "Status text",
		...over,
	};
	(organisationExtension(deps) as { factory: (api: never) => void }).factory({
		registerTool: (t: Tool) => tools.set(t.name, t),
		on: (n: string, h: Handler) => handlers.set(n, h),
	} as never);
	const run = async (name: string, args: unknown) =>
		(await tools.get(name)!.execute("id", args as never)).content[0]!.text;
	return { tools, handlers, run };
}

describe("organisation extension", () => {
	it("registers the four tools", () => {
		expect([...setup().tools.keys()].sort()).toEqual(["create_project", "org_team", "project_status", "propose_plan"]);
	});

	it("adds the organisation prompt section only when an organisation exists", async () => {
		const withOrg = setup();
		const sections: Record<string, string> = {};
		await withOrg.handlers.get("before_agent_start")!({ systemPromptOptions: { sections } });
		expect(sections.organisation).toContain("create_project");
		expect(sections.organisation).toContain("ask_dots");
		const without = setup({ exists: async () => false });
		const empty: Record<string, string> = { organisation: "stale" };
		await without.handlers.get("before_agent_start")!({ systemPromptOptions: { sections: empty } });
		expect(empty).toEqual({});
	});

	it("create_project tells the user where to look, and explains a missing team", async () => {
		const ok = setup();
		expect(await ok.run("create_project", { title: "Add SSO", brief: "x" })).toBe(
			'Planning "Add SSO" (project id prj_abc123456789). Open Organisation to review the plan.',
		);
		const none = setup({
			create: async () => {
				throw new Error("Set up your team in Organisation first.");
			},
		});
		expect(await none.run("create_project", { title: "t", brief: "b" })).toBe(
			"Set up your team in Organisation first.",
		);
	});

	it("propose_plan passes names through and returns validation problems as an error the model can fix", async () => {
		const proposePlan = vi.fn(async () => ({
			ok: false as const,
			problems: ["Task t1 depends on itself.", "The tasks depend on each other in a circle."],
		}));
		const s = setup({ proposePlan });
		const args = {
			projectId: "prj_abc123456789",
			note: "n",
			tasks: [{ id: "t1", title: "A", brief: "b", assignee: "Engineering", dependsOn: ["t1"] }],
		};
		await expect(s.run("propose_plan", args)).rejects.toThrow(
			/The plan has problems\. Fix them and call propose_plan again:\n- Task t1 depends on itself\.\n- The tasks depend on each other in a circle\./,
		);
		expect(proposePlan).toHaveBeenCalledWith("prj_abc123456789", "n", args.tasks);
		const good = setup();
		expect(await good.run("propose_plan", args)).toContain("Plan saved with 2 tasks");
	});

	it("org_team and project_status are read-only passthroughs", async () => {
		const status = vi.fn(async (id?: string) => `Status ${id ?? "all"}`);
		const s = setup({ status });
		expect(await s.run("org_team", {})).toBe("Team text");
		expect(await s.run("project_status", {})).toBe("Status all");
		expect(await s.run("project_status", { projectId: "prj_x" })).toBe("Status prj_x");
	});
});
