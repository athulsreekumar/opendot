// Organisation IPC handlers: projects, plans, tasks and reviews (docs/spec/15-organisation.md §6 to §9).
import { OpenDotError } from "../../shared/errors";
import type { IpcHandlers } from "../../shared/ipc";
import type { Services } from "../services";

type Keys =
	| "org.projects"
	| "org.project"
	| "org.createProject"
	| "org.replan"
	| "org.savePlan"
	| "org.approve"
	| "org.pause"
	| "org.resume"
	| "org.cancel"
	| "org.deleteProject"
	| "org.reviewTask"
	| "org.completeTask"
	| "org.answerTask"
	| "org.retryTask"
	| "org.skipTask"
	| "org.openDeliverable";

const notYet = async (): Promise<never> => {
	throw new OpenDotError("INTERNAL", "Not built yet.");
};

/** Replace each stub with a real implementation. */
export function projectHandlers(_s: Services): Pick<IpcHandlers, Keys> {
	return {
		"org.projects": notYet,
		"org.project": notYet,
		"org.createProject": notYet,
		"org.replan": notYet,
		"org.savePlan": notYet,
		"org.approve": notYet,
		"org.pause": notYet,
		"org.resume": notYet,
		"org.cancel": notYet,
		"org.deleteProject": notYet,
		"org.reviewTask": notYet,
		"org.completeTask": notYet,
		"org.answerTask": notYet,
		"org.retryTask": notYet,
		"org.skipTask": notYet,
		"org.openDeliverable": notYet,
	};
}
