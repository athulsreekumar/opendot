// Which Dots contribute to the briefing, and the prompts SuperDot and the Dots receive.
import type { BriefingCandidate, BriefingSettings, Connection, Dot } from "../../shared/types";

/** A calendar, mail, chat or similar source a briefing can draw on (not just files or a shell). */
function usable(c: Connection, features: string[] | undefined): boolean {
	if (!c.enabled) return false;
	if (c.type === "google" || c.type === "microsoft") return !!c.configured;
	if (c.type === "mac") {
		const f = features?.length ? features : c.features;
		return f.some((x) => x === "calendar" || x === "reminders" || x === "mail" || x === "messages" || x === "notes");
	}
	return true; // an MCP server
}

export function hasRelevantConnection(dot: Dot, conns: Connection[]): boolean {
	return dot.grants.some((g) => {
		const c = conns.find((x) => x.id === g.connectionId);
		return !!c && usable(c, g.features);
	});
}

/** Every Dot SuperDot may ask, with whether it is included after the user's overrides. */
export function briefingCandidates(
	dots: Dot[],
	conns: Connection[],
	overrides: BriefingSettings["dots"],
): BriefingCandidate[] {
	return dots
		.filter((d) => d.kind === "standard" && !d.archived && !d.hiddenFromSuper)
		.map((d) => {
			const relevant = hasRelevantConnection(d, conns);
			return { dotId: d.id, name: d.name, relevant, included: overrides[d.id] ?? relevant };
		});
}

export const NOTHING_REPLY = "NOTHING_IMPORTANT";

/** What each Dot is asked. Self-contained, because the Dot has no other context. */
export function dotQuestion(dateText: string): string {
	return [
		`Daily briefing for ${dateText}. Answer only about your own domain and the data you can reach, in at most 8 short lines:`,
		"- today's meetings and events (time and title)",
		"- emails or messages that need the user's reply",
		"- deadlines due today or soon, and anything overdue",
		"- travel or bookings that matter today",
		`If nothing important is going on in your domain, reply with exactly ${NOTHING_REPLY} and nothing else.`,
		"Do not make changes, send anything or ask the user questions.",
	].join("\n");
}

/** The message that starts SuperDot's briefing turn. */
export function briefingPrompt(opts: { dateText: string; dotNames: string[]; instructions: string }): string {
	const lines = [
		`[OpenDot · daily briefing · ${opts.dateText}]`,
		"Prepare the user's daily briefing now.",
		"1. Call ask_dots ONCE with one request for each of these Dots (use up to 6 per call; if there are more, call ask_dots again with the rest in the same step):",
		...opts.dotNames.map((n) => `   - ${n}`),
		"   Give every Dot exactly this question:",
		...dotQuestion(opts.dateText)
			.split("\n")
			.map((l) => `   | ${l}`),
		`2. Skip every Dot that replied ${NOTHING_REPLY}. If a Dot did not answer, say so in one short line, for example "Calendar didn't answer".`,
		"3. Write ONE briefing for today. Urgent things first, then today's schedule, then everything else in one line each. Attribute every fact with the Dot's name in square brackets, like [Inbox] or [Calendar]. Keep it short and scannable, with no greeting.",
		"4. Never invent what a Dot said. If every Dot had nothing important, say that in one sentence.",
	];
	if (opts.instructions.trim()) lines.push(`The user also asked: ${opts.instructions.trim().slice(0, 1000)}`);
	return lines.join("\n");
}

export const NO_DOTS_NOTE =
	"There is nothing to brief you on yet. Connect Google or Microsoft in Connections, give a Dot access to your calendar or mail, and tomorrow's briefing will have something in it.";

export function budgetNote(reason: string): string {
	return `Skipped today's briefing: ${reason.replace(/\.$/, "")}.`;
}
