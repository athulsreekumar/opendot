// mac-calendar watcher (spec 12 §4): remind N minutes before events in the next 24 h. Cursor = JSON { sent: string[] }.
import { z } from "zod";
import { isNotAuthorized, jsString } from "../../connections/mac/jxa";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";
import { NeedsAuthError } from "../types";

type Config = { remindMinutes: number[] };
interface CalEvent {
	id: string;
	title: string;
	start: string;
	end: string;
	calendar: string;
	location?: string;
}

function script(fromIso: string, toIso: string): string {
	return `(function(){
const app = Application("Calendar");
const from = new Date(${jsString(fromIso)});
const to = new Date(${jsString(toIso)});
const out = [];
for (const cal of app.calendars()) {
  for (const e of cal.events.whose({_and:[{startDate:{_greaterThan:from}},{startDate:{_lessThan:to}}]})()) {
    out.push({id:e.uid(), title:e.summary(), start:e.startDate().toISOString(), end:e.endDate().toISOString(), calendar:cal.name(), location:e.location()||""});
  }
}
return JSON.stringify(out);
})()`;
}

async function fetchEvents(ctx: SourceCtx<Config>): Promise<CalEvent[]> {
	const now = ctx.deps.now();
	const to = new Date(now.getTime() + 24 * 3600_000);
	try {
		const out = await ctx.deps.runJxa(script(now.toISOString(), to.toISOString()), 15000);
		return JSON.parse(out) as CalEvent[];
	} catch (err) {
		if (isNotAuthorized(err)) throw new NeedsAuthError("Allow OpenDot to control Calendar in System Settings");
		throw err;
	}
}

function toEvent(e: CalEvent, m: number, now: Date): NewEvent {
	const mins = Math.max(0, Math.round((new Date(e.start).getTime() - now.getTime()) / 60000));
	return {
		title: `Starting in ${mins} min: ${e.title}`,
		body: [e.title, `Starts ${e.start}`, e.location ? `Location: ${e.location}` : ""].filter(Boolean).join("\n"),
		facts: { title: e.title, start: e.start, end: e.end, calendar: e.calendar, location: e.location ?? "" },
		dedupeKey: `mac-calendar:${e.id}:${e.start}:${m}`,
		importanceHint: "normal",
		occurredAt: now.toISOString(),
	};
}

function parseCursor(c: string | undefined): string[] {
	if (!c) return [];
	try {
		const v = JSON.parse(c) as { sent?: string[] };
		return Array.isArray(v.sent) ? v.sent : [];
	} catch {
		return [];
	}
}

export const macCalendarSource: WatcherSource<Config> = {
	type: "mac-calendar",
	label: "Calendar (this Mac)",
	requires: { connectionType: "mac", feature: "calendar" },
	configSchema: z.object({
		remindMinutes: z.array(z.number().min(0).max(1440)).default([15]),
	}) as unknown as z.ZodType<Config>,
	defaultIntervalSec: 120,
	minIntervalSec: 60,
	async poll(ctx, cursor) {
		const now = ctx.deps.now();
		const events = await fetchEvents(ctx);
		const minutes = ctx.config.remindMinutes?.length ? ctx.config.remindMinutes : [15];
		const sent = new Set(parseCursor(cursor));
		const live = new Set<string>();
		const out: NewEvent[] = [];
		for (const e of events) {
			const startMs = new Date(e.start).getTime();
			for (const m of minutes) {
				const key = `${e.id}:${e.start}:${m}`;
				live.add(key);
				const due = startMs > now.getTime() && startMs - now.getTime() <= m * 60000;
				if (due && !sent.has(key)) {
					sent.add(key);
					// first run (no cursor): record as sent but stay silent
					if (cursor !== undefined) out.push(toEvent(e, m, now));
				}
			}
		}
		// prune keys for events no longer in the window
		const keep = [...sent].filter((k) => live.has(k));
		return { events: out, cursor: JSON.stringify({ sent: keep }) };
	},
	async test(ctx) {
		try {
			const events = await fetchEvents(ctx);
			const now = ctx.deps.now();
			const m = ctx.config.remindMinutes?.[0] ?? 15;
			return {
				ok: true,
				message: `${events.length} event(s) in the next 24 h`,
				sample: events.slice(0, 3).map((e) => toEvent(e, m, now)),
			};
		} catch (err) {
			return { ok: false, message: err instanceof Error ? err.message : String(err), sample: [] };
		}
	},
};
