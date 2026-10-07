// Organisation skills for a member Dot (spec 15 §4): a `skills` prompt section listing name and description,
// and a read-only `use_skill({ name })` tool that returns the playbook. The full text is never in the prompt.
// The section is rebuilt every turn, so edits to skills or to the member's list apply immediately.
import type { OrgMember, Skill } from "../../../shared/organisation";
import { defineTool, type InlineExtension, Type } from "../pi-adapter";

export const SKILLS_NOTE = "These are the organisation's own instructions.";

export interface SkillsExtDeps {
	/** The organisation member for this Dot, if it is one. */
	member: () => Promise<OrgMember | undefined>;
	/** A skill by id; throws or returns undefined when it no longer exists. */
	skill: (id: string) => Promise<Skill | undefined>;
}

async function memberSkills(deps: SkillsExtDeps): Promise<Skill[]> {
	const m = await deps.member();
	if (!m || m.skillIds.length === 0) return [];
	const out: Skill[] = [];
	for (const id of m.skillIds) {
		try {
			const s = await deps.skill(id);
			if (s) out.push(s);
		} catch {
			/* a skill that was deleted is simply not listed */
		}
	}
	return out;
}

export function skillsSection(skills: Skill[]): string {
	const lines = skills.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`);
	return `Your organisation gave you these skills (playbooks). When one fits your task, call use_skill with its name and follow it:\n${lines.join("\n")}`;
}

export function skillsExtension(deps: SkillsExtDeps): InlineExtension {
	return {
		name: "opendot-skills",
		hidden: true,
		factory: (api) => {
			api.on("before_agent_start", async (event) => {
				const s = event.systemPromptOptions.sections;
				const skills = await memberSkills(deps).catch(() => []);
				if (skills.length > 0) s.skills = skillsSection(skills);
				else delete s.skills;
			});
			api.registerTool(
				defineTool({
					name: "use_skill",
					label: "Skill",
					description:
						"Read one of your organisation's skills (a playbook) by name. Use it before you start work the skill covers.",
					parameters: Type.Object({ name: Type.String({ description: "The skill name, as listed in your skills." }) }),
					annotations: { readOnlyHint: true },
					async execute(_id, p) {
						const skills = await memberSkills(deps);
						const q = p.name.trim().toLowerCase();
						const hit = skills.find((s) => s.name.toLowerCase() === q || s.id.toLowerCase() === q);
						if (!hit) {
							const names = skills.map((s) => s.name).join(", ");
							throw new Error(
								skills.length ? `No skill called "${p.name}". Your skills: ${names}.` : "You have no skills right now.",
							);
						}
						return {
							content: [{ type: "text", text: `${SKILLS_NOTE}\n\n# ${hit.name}\n\n${hit.body}` }],
							details: undefined,
						};
					},
				}),
			);
		},
	};
}
