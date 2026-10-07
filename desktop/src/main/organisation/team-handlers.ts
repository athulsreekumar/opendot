// Organisation IPC handlers: team, catalog and skills (docs/spec/15-organisation.md §3 to §5).
import { OpenDotError } from "../../shared/errors";
import type { IpcHandlers } from "../../shared/ipc";
import type { SkillInput } from "../../shared/organisation";
import type { Services } from "../services";
import { ORG_DOMAINS, ORG_TEMPLATES } from "./catalog";

type Keys =
	| "org.state"
	| "org.catalog"
	| "org.setup"
	| "org.addMember"
	| "org.removeMember"
	| "org.setMemberSkills"
	| "org.skills"
	| "org.skill"
	| "org.saveSkill"
	| "org.deleteSkill";

const str = (v: unknown, what: string, max = 200): string => {
	if (typeof v !== "string" || v.length === 0 || v.length > max)
		throw new OpenDotError("INVALID_ARGS", `${what} is not valid.`);
	return v;
};

/** Validates what the renderer sends (the IPC layer only checks the channel name). */
function skillInput(v: SkillInput): SkillInput {
	if (!v || typeof v !== "object") throw new OpenDotError("INVALID_ARGS", "The skill is not valid.");
	const body = typeof v.body === "string" ? v.body : "";
	return {
		...(v.id !== undefined ? { id: str(v.id, "The skill id", 100) } : {}),
		name: typeof v.name === "string" ? v.name : "",
		description: typeof v.description === "string" ? v.description : "",
		...(typeof v.domain === "string" && v.domain ? { domain: v.domain } : {}),
		body,
	};
}

export function teamHandlers(s: Services): Pick<IpcHandlers, Keys> {
	return {
		"org.state": () => s.team.state(),
		"org.catalog": async () => ({ templates: ORG_TEMPLATES, domains: ORG_DOMAINS }),
		"org.setup": (input) => {
			const domains = input?.domains;
			if (domains !== undefined && (!Array.isArray(domains) || domains.some((d) => typeof d !== "string")))
				throw new OpenDotError("INVALID_ARGS", "The domains are not valid.");
			return s.team.setup({
				templateId: str(input?.templateId, "The template", 60),
				...(typeof input.name === "string" ? { name: input.name } : {}),
				...(domains ? { domains } : {}),
			});
		},
		"org.addMember": (input) =>
			s.team.addMember({
				domain: str(input?.domain, "The domain", 60),
				...(input.dotId !== undefined ? { dotId: str(input.dotId, "The Dot", 80) as typeof input.dotId } : {}),
			}),
		"org.removeMember": (dotId) => s.team.removeMember(str(dotId, "The Dot", 80) as typeof dotId),
		"org.setMemberSkills": (dotId, skillIds) => {
			if (!Array.isArray(skillIds) || skillIds.some((x) => typeof x !== "string" || x.length > 100))
				throw new OpenDotError("INVALID_ARGS", "The skills are not valid.");
			return s.team.setMemberSkills(str(dotId, "The Dot", 80) as typeof dotId, skillIds);
		},
		"org.skills": () => s.skills.list(),
		"org.skill": (id) => s.skills.get(str(id, "The skill", 100)),
		"org.saveSkill": (input) => s.skills.save(skillInput(input)),
		"org.deleteSkill": (id) => s.skills.delete(str(id, "The skill", 100)),
	};
}
