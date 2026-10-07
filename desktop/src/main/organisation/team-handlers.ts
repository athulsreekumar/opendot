// Organisation IPC handlers: team, catalog and skills (docs/spec/15-organisation.md §3 to §5).
import { OpenDotError } from "../../shared/errors";
import type { IpcHandlers } from "../../shared/ipc";
import type { Services } from "../services";

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

const notYet = async (): Promise<never> => {
	throw new OpenDotError("INTERNAL", "Not built yet.");
};

/** Replace each stub with a real implementation. */
export function teamHandlers(_s: Services): Pick<IpcHandlers, Keys> {
	return {
		"org.state": notYet,
		"org.catalog": notYet,
		"org.setup": notYet,
		"org.addMember": notYet,
		"org.removeMember": notYet,
		"org.setMemberSkills": notYet,
		"org.skills": notYet,
		"org.skill": notYet,
		"org.saveSkill": notYet,
		"org.deleteSkill": notYet,
	};
}
