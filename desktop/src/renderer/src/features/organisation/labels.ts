import type { OrgProjectStatus, OrgTask, OrgTaskStatus } from "@shared/organisation";

type Tone = "success" | "warning" | "danger" | "info" | "muted";

export const PROJECT_STATUS: Record<OrgProjectStatus, { label: string; tone: Tone }> = {
	planning: { label: "SuperDot is planning…", tone: "info" },
	"awaiting-approval": { label: "Waiting for you", tone: "warning" },
	running: { label: "Running", tone: "info" },
	paused: { label: "Paused", tone: "warning" },
	done: { label: "Done", tone: "success" },
	failed: { label: "Stopped", tone: "danger" },
	cancelled: { label: "Cancelled", tone: "muted" },
};

export const TASK_STATUS: Record<OrgTaskStatus, { label: string; tone: Tone }> = {
	pending: { label: "Not started", tone: "muted" },
	running: { label: "Working on it", tone: "info" },
	"needs-input": { label: "Waiting for you", tone: "warning" },
	review: { label: "In review", tone: "info" },
	done: { label: "Done", tone: "success" },
	failed: { label: "Failed", tone: "danger" },
	skipped: { label: "Skipped", tone: "muted" },
};

export const UPDATE_KIND: Record<string, string> = {
	"plan-ready": "Plan ready",
	"needs-input": "Waiting for you",
	"needs-review": "Needs your review",
	done: "Done",
	failed: "Stopped",
	paused: "Paused",
};

export type BoardColumnId = "todo" | "progress" | "review" | "done";

export const BOARD_COLUMNS: Array<{ id: BoardColumnId; label: string; statuses: OrgTaskStatus[] }> = [
	{ id: "todo", label: "To do", statuses: ["pending"] },
	{ id: "progress", label: "In progress", statuses: ["running", "needs-input"] },
	{ id: "review", label: "In review", statuses: ["review"] },
	{ id: "done", label: "Done", statuses: ["done", "skipped", "failed"] },
];

export function columnTasks(tasks: OrgTask[], statuses: OrgTaskStatus[]): OrgTask[] {
	return tasks.filter((t) => statuses.includes(t.status));
}

export function money(n: number): string {
	return `$${n.toFixed(2)}`;
}

export function spendLabel(spent: number, budget?: number): string {
	return budget !== undefined ? `${money(spent)} of ${money(budget)}` : `${money(spent)} spent`;
}
