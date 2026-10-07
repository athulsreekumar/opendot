// Prompt text for project work: task messages, reviews, the planner and the final report (docs/spec/15-organisation.md §5 to §7).
// Pure functions, so they are easy to test. Never put these in a log.
import type { OrgProject, OrgTask } from "../../shared/organisation";
import { ORG_LIMITS } from "../../shared/organisation";

export const RESULT_TRIM = 1500;

export const trim = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export interface DepInfo {
	title: string;
	assigneeName: string;
	result?: string;
	deliverables: string[];
}

const PROTOCOL = [
	"Reply when finished. Start your reply with [DONE] and say what you did and where to find it.",
	"If you cannot continue without the user, start with [BLOCKED] and ask one clear question.",
];

/** The first message of a task (spec §6.1). */
export function taskPrompt(p: OrgProject, t: OrgTask, deps: DepInfo[]): string {
	const lines = [
		`Task from the project "${p.title}" (task ${t.id} of ${p.tasks.length}): ${t.title}`,
		"",
		`Project request: ${p.brief}`,
		`What to do and what "done" means: ${t.brief}`,
	];
	if (deps.length) {
		lines.push("", "Work you can build on (from tasks this one depends on):");
		for (const d of deps) {
			lines.push(`## ${d.title} (${d.assigneeName})`);
			const body = [
				d.result ? trim(d.result, RESULT_TRIM) : "",
				d.deliverables.length ? `Files: ${d.deliverables.join(", ")}` : "",
			]
				.filter(Boolean)
				.join("\n");
			lines.push(body || "(no details)");
		}
	}
	lines.push(
		"",
		`Put files you create in your workspace under projects/${p.id}/${t.id}/ and mention each one by name.`,
		...PROTOCOL,
	);
	return lines.join("\n");
}

/** Sent to the assignee after a reviewer (or the user) asked for changes. The conversation continues in the same link session. */
export function revisionPrompt(p: OrgProject, t: OrgTask, notes: string): string {
	return [
		`Changes requested on task ${t.id} "${t.title}" in the project "${p.title}".`,
		`The reviewer asked for changes: ${trim(notes || "No details were given.", ORG_LIMITS.answerMax)}`,
		"Fix them and reply the same way.",
		`Keep putting files in projects/${p.id}/${t.id}/.`,
		...PROTOCOL,
	].join("\n");
}

/** Sent to the assignee with the user's answer to a [BLOCKED] question. */
export function answerPrompt(p: OrgProject, t: OrgTask, answer: string): string {
	return [
		`The user answered your question on task ${t.id} "${t.title}" in the project "${p.title}":`,
		trim(answer, ORG_LIMITS.answerMax),
		"Continue the task and reply the same way.",
		`Keep putting files in projects/${p.id}/${t.id}/.`,
		...PROTOCOL,
	].join("\n");
}

/** What a Dot reviewer is asked (spec §7). */
export function reviewPrompt(
	p: OrgProject,
	t: OrgTask,
	assigneeName: string,
	files: string[],
	texts: Array<{ title: string; text: string }>,
): string {
	const lines = [
		`Review request for task ${t.id} "${t.title}" in the project "${p.title}". The work was done by ${assigneeName}.`,
		"",
		`What was asked and what "done" means: ${t.brief}`,
		"",
		`${assigneeName}'s result:`,
		trim(t.result ?? "(no reply)", 3000),
	];
	if (files.length) lines.push("", `Files: ${files.join(", ")}`);
	for (const x of texts) lines.push("", `--- ${x.title} ---`, x.text);
	lines.push(
		"",
		"Check the work against what was asked. Reply [APPROVE] and a one-line reason, or [CHANGES] and a numbered list of what must change.",
	);
	return lines.join("\n");
}

export interface TeamLine {
	name: string;
	domain: string;
	skills: string[];
	about: string;
}

/** The planner turn (spec §5). `reviewedBy` maps a domain to the domains that usually review it. */
export function plannerPrompt(
	p: OrgProject,
	team: TeamLine[],
	reviewedBy: Record<string, string[]>,
	feedback?: string,
): string {
	const lines = [
		`[OpenDot · organisation · plan project "${p.title}"]`,
		`Plan this project now. Project id: ${p.id}`,
		"",
		`Request from the user: ${p.brief}`,
		"",
		"Team (assignee names to use):",
		...team.map(
			(m) =>
				`- ${m.name} (${m.domain})${m.skills.length ? `, skills: ${m.skills.join(", ")}` : ""}${m.about ? `. ${trim(m.about, 140)}` : ""}${
					reviewedBy[m.domain]?.length ? `. Work is usually reviewed by: ${reviewedBy[m.domain]!.join(", ")}` : ""
				}`,
		),
		"- human (the user: for anything only they can do, decide or approve)",
		"",
		"Rules:",
		"1. 3 to 12 tasks, each owned by exactly one member.",
		"2. Tasks that don't need each other have no dependencies, so they run in parallel.",
		"3. Every engineering task has a reviewer from another domain (see 'usually reviewed by'), or \"human\" for anything risky or irreversible.",
		"4. A reviewer is never the assignee.",
		'5. Tasks only the user can do have the assignee "human".',
		'6. Each task brief says what "done" means and what the assignee should deliver.',
		`7. Task ids are short: t1, t2, t3 ... "dependsOn" lists task ids.`,
		`8. Call propose_plan exactly once, with projectId "${p.id}", a one-paragraph note explaining the plan, and the tasks. If it returns problems, fix them and call it again.`,
		"After propose_plan succeeds, reply with one short sentence. Do not start any of the work yourself.",
	];
	if (feedback?.trim())
		lines.push("", `The user asked for a different plan: ${trim(feedback.trim(), ORG_LIMITS.briefMax)}`);
	return lines.join("\n");
}

/** The final report turn (spec §6). */
export function reportPrompt(p: OrgProject, nameOf: (id: string) => string): string {
	const lines = [
		`[OpenDot · organisation · final report for project "${p.title}"]`,
		`Write the final report for the user now, in Markdown. Request: ${p.brief}`,
		"",
		"Tasks:",
	];
	for (const t of p.tasks) {
		const who = t.assignee === "human" ? "you (the user)" : nameOf(t.assignee);
		lines.push(
			`- ${t.id} "${t.title}" by ${who}: ${t.status}${t.result ? `. Result: ${trim(t.result.replace(/\s+/g, " "), 400)}` : ""}${
				t.deliverables.length ? `. Files: ${t.deliverables.map((d) => d.title).join(", ")}` : ""
			}${t.status === "skipped" && t.error ? `. ${t.error}` : ""}`,
		);
	}
	lines.push(
		"",
		"The report lists what was delivered and where (Dot name and file name), anything that needs the user, and every task that was skipped and why.",
		"Be short and factual. Do not call any tools. Never invent results that are not listed above.",
	);
	return lines.join("\n");
}

/** Used when the report turn fails, so a finished project still has a summary. */
export function fallbackSummary(p: OrgProject, nameOf: (id: string) => string): string {
	const done = p.tasks.filter((t) => t.status === "done");
	const skipped = p.tasks.filter((t) => t.status === "skipped");
	const lines = [`## ${p.title}`, "", `${done.length} of ${p.tasks.length} tasks are done.`, ""];
	for (const t of done) {
		const who = t.assignee === "human" ? "You" : nameOf(t.assignee);
		lines.push(
			`- ${t.title} (${who})${t.deliverables.length ? `: ${t.deliverables.map((d) => d.title).join(", ")}` : ""}`,
		);
	}
	if (skipped.length) {
		lines.push("", "Skipped:");
		for (const t of skipped) lines.push(`- ${t.title}${t.error ? `. ${t.error}` : ""}`);
	}
	return lines.join("\n");
}

/** The "organisation" section of SuperDot's prompt, only when an organisation exists. */
export const ORG_SECTION =
	"The user has an organisation: a team of Dots, one per domain. For a request that needs several people, call create_project. For quick questions keep using ask_dots. Use org_team to see who is on the team and project_status to report on projects. Never start project work yourself.";

/** One line for the daily briefing prompt (spec §8). */
export function activeProjectsLine(
	items: Array<{ title: string; done: number; total: number; waiting: number }>,
): string | undefined {
	if (!items.length) return undefined;
	return `Active projects: ${items
		.map((i) => `${i.title} (${i.done} of ${i.total} done${i.waiting ? `, ${i.waiting} waiting for you` : ""})`)
		.join("; ")}`;
}
