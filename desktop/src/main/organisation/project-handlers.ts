// Organisation IPC handlers: projects, plans, tasks and reviews (docs/spec/15-organisation.md §6 to §9).
import { isOpenSafe } from "../../shared/attachments";
import { OpenDotError } from "../../shared/errors";
import type { IpcHandlers } from "../../shared/ipc";
import type { AppActions } from "../ipc/handlers";
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

export function projectHandlers(
	s: Services,
	app?: Pick<AppActions, "openPath" | "revealPath" | "openExternal">,
): Pick<IpcHandlers, Keys> {
	const p = () => s.projects;
	return {
		"org.projects": () => p().list(),
		"org.project": (id) => p().get(id),
		"org.createProject": (input) => p().create(input),
		"org.replan": (id, feedback) => p().replan(id, feedback),
		"org.savePlan": (id, tasks) => p().savePlan(id, tasks),
		"org.approve": (id) => p().approve(id),
		"org.pause": (id) => p().pause(id),
		"org.resume": (id) => p().resume(id),
		"org.cancel": (id) => p().cancel(id),
		"org.deleteProject": (id) => p().deleteProject(id),
		"org.reviewTask": (id, taskId, verdict, note) => p().reviewTask(id, taskId, verdict, note),
		"org.completeTask": (id, taskId, note) => p().completeTask(id, taskId, note),
		"org.answerTask": (id, taskId, answer) => p().answerTask(id, taskId, answer),
		"org.retryTask": (id, taskId) => p().retryTask(id, taskId),
		"org.skipTask": (id, taskId) => p().skipTask(id, taskId),
		"org.openDeliverable": async (id, taskId, index) => {
			if (!app) throw new OpenDotError("INTERNAL", "Can't open files here.");
			const target = await p().deliverablePath(id, taskId, index);
			if (target.url) {
				if (!/^https:\/\//i.test(target.url)) throw new OpenDotError("INVALID", "Only secure links can be opened.");
				return app.openExternal(target.url);
			}
			const file = target.path!;
			if (!isOpenSafe(file)) return app.revealPath(file);
			const err = await app.openPath(file);
			if (err) await app.revealPath(file);
		},
	};
}
