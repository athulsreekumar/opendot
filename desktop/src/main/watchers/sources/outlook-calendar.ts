// Outlook calendar watcher (spec 12 §4): calendarView delta + reminders once per (event, minutes).
// Cursor JSON: { delta, windowEnd, events: {id: {s, t}}, reminded: ["id|min|start"] }.
import { z } from "zod";
import { graphJson, oneLine } from "../../connections/microsoft/client";
import type { NewEvent, WatcherSource } from "../types";
import { drainDelta, graphDeps } from "./outlook-mail";

interface Ev {
	id: string;
	subject?: string;
	start?: { dateTime: string };
	isCancelled?: boolean;
	"@removed"?: unknown;
}
interface Known {
	s: string;
	t: string;
}
interface State {
	delta: string;
	windowEnd: string;
	events: Record<string, Known>;
	reminded: string[];
}

const configSchema = z.object({ remindMinutes: z.array(z.number()).default([15]) });
type Config = z.infer<typeof configSchema>;

const DAY = 24 * 3600 * 1000;
const HEADERS = { Prefer: 'outlook.timezone="UTC"' };

function startUrl(now: Date): { url: string; windowEnd: string } {
	const end = new Date(now.getTime() + 7 * DAY);
	return {
		url: `/me/calendarView/delta?startDateTime=${encodeURIComponent(now.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}`,
		windowEnd: end.toISOString(),
	};
}

const toIso = (dt: string) => (/(Z|[+-]\d{2}:?\d{2})$/.test(dt) ? dt : `${dt}Z`);

function parseState(cursor: string): State | undefined {
	try {
		const s = JSON.parse(cursor) as State;
		return s && typeof s.delta === "string" ? { ...s, events: s.events ?? {}, reminded: s.reminded ?? [] } : undefined;
	} catch {
		return undefined;
	}
}

function ev(
	title: string,
	e: { id: string; s: string; t: string },
	key: string,
	hint: "normal" | "high",
	now: Date,
): NewEvent {
	return {
		title,
		body: `${e.s} at ${e.t}`,
		facts: { subject: e.s, start: e.t, eventId: e.id },
		dedupeKey: key,
		importanceHint: hint,
		occurredAt: now.toISOString(),
	};
}

export const outlookCalendarSource: WatcherSource<Config> = {
	type: "outlook-calendar",
	label: "Outlook calendar",
	requires: { connectionType: "microsoft", feature: "calendar" },
	configSchema,
	defaultIntervalSec: 60,
	minIntervalSec: 30,
	async poll(ctx, cursor) {
		const g = graphDeps(ctx.deps);
		const now = ctx.deps.now();
		let state = cursor ? parseState(cursor) : undefined;
		let resync = !state || new Date(state.windowEnd).getTime() - now.getTime() < DAY;
		const events: NewEvent[] = [];

		if (!resync && state) {
			const r = await drainDelta<Ev>(g, state.delta, startUrl(now).url, HEADERS);
			if (r.reset) resync = true;
			else {
				for (const it of r.items) {
					const known = state.events[it.id];
					if (it["@removed"] || it.isCancelled) {
						if (known) {
							events.push(
								ev(
									`Event cancelled: ${oneLine(known.s)}`,
									{ id: it.id, ...known },
									`cancel:${it.id}:${known.t}`,
									"normal",
									now,
								),
							);
							delete state.events[it.id];
						}
						continue;
					}
					if (!it.start) continue;
					const next = { s: it.subject ?? "(no subject)", t: toIso(it.start.dateTime) };
					const verb = known ? "changed" : "added";
					if (!known || known.s !== next.s || known.t !== next.t) {
						events.push(
							ev(
								`Event ${verb}: ${oneLine(next.s)}`,
								{ id: it.id, ...next },
								`${verb}:${it.id}:${next.t}:${next.s}`,
								"normal",
								now,
							),
						);
					}
					state.events[it.id] = next;
				}
				state.delta = r.deltaLink ?? state.delta;
			}
		}

		if (resync) {
			const { url, windowEnd } = startUrl(now);
			const r = await drainDelta<Ev>(g, url, url, HEADERS);
			const known: Record<string, Known> = {};
			for (const it of r.items) {
				if (it["@removed"] || it.isCancelled || !it.start) continue;
				known[it.id] = { s: it.subject ?? "(no subject)", t: toIso(it.start.dateTime) };
			}
			state = { delta: r.deltaLink ?? "", windowEnd, events: known, reminded: state?.reminded ?? [] };
			if (!state.delta) return { events: [], cursor: undefined };
			// Resync is silent for changes, but reminders below still apply when we had a prior cursor.
			if (!cursor) return { events: [], cursor: JSON.stringify(state) };
		}
		if (!state) return { events: [], cursor: undefined };

		// Reminders: once per (eventId, minutes, start).
		const reminded = new Set(state.reminded);
		for (const [id, k] of Object.entries(state.events)) {
			const until = (new Date(k.t).getTime() - now.getTime()) / 60000;
			if (until < 0) {
				delete state.events[id];
				continue;
			}
			for (const m of ctx.config.remindMinutes) {
				const key = `${id}|${m}|${k.t}`;
				if (until <= m && !reminded.has(key)) {
					reminded.add(key);
					events.push(ev(`Starts in ${m} min: ${oneLine(k.s)}`, { id, ...k }, `remind:${key}`, "high", now));
				}
			}
		}
		state.reminded = [...reminded].filter((key) => {
			const [id, , t] = key.split("|");
			return id !== undefined && state?.events[id]?.t === t;
		});
		return { events, cursor: JSON.stringify(state) };
	},
	async test(ctx) {
		try {
			const now = ctx.deps.now();
			const end = new Date(now.getTime() + 7 * DAY);
			const data = await graphJson<{ value?: Ev[] }>(
				graphDeps(ctx.deps),
				`/me/calendarView?startDateTime=${encodeURIComponent(now.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}&$top=3&$orderby=start/dateTime&$select=id,subject,start`,
				{ headers: HEADERS },
			);
			const sample = (data.value ?? [])
				.filter((e) => e.start)
				.slice(0, 3)
				.map((e) =>
					ev(
						`Upcoming: ${oneLine(e.subject)}`,
						{ id: e.id, s: e.subject ?? "", t: toIso(e.start?.dateTime ?? "") },
						e.id,
						"normal",
						now,
					),
				);
			return { ok: true, message: `Connected. ${sample.length} upcoming event(s) this week.`, sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
