import type { OrgTaskInput } from "@shared/organisation";

/** The plan checker talks about task ids ("t3"); the screen numbers the rows, so say "Task 3" here. */
export function friendlyProblem(message: string, tasks: OrgTaskInput[]): string {
	const row = new Map(tasks.map((t, i) => [t.id, i + 1]));
	return message
		.replace(/\bTask ([A-Za-z0-9_-]+)/g, (m, id: string) => (row.has(id) ? `Task ${row.get(id)}` : m))
		.replace(/"([A-Za-z0-9_-]+)"/g, (m, id: string) => (row.has(id) ? `task ${row.get(id)}` : m));
}
