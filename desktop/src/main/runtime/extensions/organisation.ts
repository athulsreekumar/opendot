// SuperDot as project manager: org_team, create_project, propose_plan, project_status (docs/spec/15-organisation.md §5).
// Registered on the Super session only. The tools are thin: the rules live in ProjectService.
import type { OrgCreateProjectInput, OrgProject } from "../../../shared/organisation";
import { ORG_SECTION } from "../../organisation/project-prompts";
import type { NamedTaskInput } from "../../organisation/project-service";
import { defineTool, type InlineExtension, Type } from "../pi-adapter";

export interface OrgToolsDeps {
	/** True once the user has set up an organisation. The prompt section is added only then. */
	exists: () => Promise<boolean>;
	team: () => Promise<string>;
	create: (input: OrgCreateProjectInput) => Promise<OrgProject>;
	proposePlan: (
		projectId: string,
		note: string,
		tasks: NamedTaskInput[],
	) => Promise<{ ok: true; taskCount: number } | { ok: false; problems: string[] }>;
	status: (projectId?: string) => Promise<string>;
}

const NO_ORG = "There is no organisation yet. Ask the user to set up a team in Organisation first.";

export function organisationExtension(deps: OrgToolsDeps): InlineExtension {
	return {
		name: "opendot-organisation",
		hidden: true,
		factory: (api) => {
			api.on("before_agent_start", async (event) => {
				const s = event.systemPromptOptions.sections;
				if (await deps.exists().catch(() => false)) s.organisation = ORG_SECTION;
				else delete s.organisation;
			});
			api.registerTool(
				defineTool({
					name: "org_team",
					label: "Organisation team",
					description:
						"Read-only: the members of the user's organisation (name, domain, skills, what they know) and the user as 'human'. Use before planning.",
					parameters: Type.Object({}),
					annotations: { readOnlyHint: true },
					async execute() {
						return { content: [{ type: "text", text: await deps.team() }], details: undefined };
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "create_project",
					label: "Create project",
					description:
						"Create a project for a request that needs several people on the team, and start planning it. The plan is written in the background and the user approves it in Organisation. Do not do the work yourself.",
					parameters: Type.Object({
						title: Type.String({ description: "Short project title", maxLength: 120 }),
						brief: Type.String({
							description: "The request in the user's words, with every detail that matters",
							maxLength: 8000,
						}),
					}),
					async execute(_id, p) {
						let text: string;
						try {
							const project = await deps.create({ title: p.title, brief: p.brief });
							text = `Planning "${project.title}" (project id ${project.id}). Open Organisation to review the plan.`;
						} catch (e) {
							text = e instanceof Error ? e.message : NO_ORG;
						}
						return { content: [{ type: "text", text }], details: undefined };
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "propose_plan",
					label: "Propose plan",
					description:
						"The planner's output. Only valid while a project is being planned. Call it exactly once; if it returns problems, fix them and call it again. Assignees and reviewers are Dot names or 'human'.",
					parameters: Type.Object({
						projectId: Type.String(),
						note: Type.String({ description: "One paragraph that explains the plan to the user", maxLength: 4000 }),
						tasks: Type.Array(
							Type.Object({
								id: Type.String({ description: "t1, t2, ..." }),
								title: Type.String(),
								brief: Type.String({ description: "What to do and what 'done' means" }),
								assignee: Type.String({ description: "Dot name, or 'human'" }),
								dependsOn: Type.Array(Type.String()),
								reviewer: Type.Optional(Type.String({ description: "Dot name or 'human'" })),
							}),
							{ minItems: 1, maxItems: 20 },
						),
					}),
					async execute(_id, p) {
						const r = await deps.proposePlan(p.projectId, p.note, p.tasks);
						if (!r.ok)
							throw new Error(
								`The plan has problems. Fix them and call propose_plan again:\n- ${r.problems.join("\n- ")}`,
							);
						return {
							content: [
								{
									type: "text",
									text: `Plan saved with ${r.taskCount} tasks. It now waits for the user's approval. Reply with one short sentence.`,
								},
							],
							details: undefined,
						};
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "project_status",
					label: "Project status",
					description:
						"Read-only: status of a project (or of the latest projects when no id is given): its tasks, who is waiting on whom, and what needs the user.",
					parameters: Type.Object({ projectId: Type.Optional(Type.String()) }),
					annotations: { readOnlyHint: true },
					async execute(_id, p) {
						return { content: [{ type: "text", text: await deps.status(p.projectId) }], details: undefined };
					},
				}),
			);
		},
	};
}
