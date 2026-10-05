// Google Calendar watcher source (spec 12 §4): syncToken changes + one-shot reminders kept in the cursor JSON.
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

const CAL = "https://www.googleapis.com/calendar/v3";

const configSchema = z.object({
	calendarId: z.string().default("primary"),
	remindMinutes: z.array(z.number()).default([15]),
});
type Config = z.infer<typeof configSchema>;

interface CalEvent {
	id: string;
	summary?: string;
	status?: string;
	created?: string;
	updated?: string;
	location?: string;
	hangoutLink?: string;
	description?: string;
	start?: { dateTime?: string; date?: string };
	end?: { dateTime?: string; date?: string };
}
interface ListResp {
	items?: CalEvent[];
	nextPageToken?: string;
	nextSyncToken?: string;
}
interface CursorState {
	sync: string;
	/** "<eventId>|<minutes>" -> event start (epoch ms), pruned once the start is past. */
	reminded: Record<string, number>;
}

class SyncExpired extends Error {}

async function list(ctx: SourceCtx<Config>, params: Record<string, string>): Promise<ListResp> {
	const token = await ctx.deps.getAccessToken("google");
	const cal = encodeURIComponent(ctx.config.calendarId ?? "primary");
	const res = await ctx.deps.fetch(`${CAL}/calendars/${cal}/events?${new URLSearchParams(params)}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: ctx.signal,
	});
	if (res.status === 410) throw new SyncExpired();
	if (!res.ok) throw new Error(`Calendar API error ${res.status}`);
	return (await res.json()) as ListResp;
}

async function listAll(
	ctx: SourceCtx<Config>,
	params: Record<string, string>,
): Promise<{ items: CalEvent[]; syncToken?: string }> {
	const items: CalEvent[] = [];
	let page: string | undefined;
	let syncToken: string | undefined;
	do {
		const r = await list(ctx, page ? { ...params, pageToken: page } : params);
		items.push(...(r.items ?? []));
		page = r.nextPageToken;
		syncToken = r.nextSyncToken ?? syncToken;
	} while (page);
	return { items, syncToken };
}

const startMs = (e: CalEvent) => {
	const s = e.start?.dateTime;
	return s ? new Date(s).getTime() : Number.NaN;
};
const hhmm = (iso?: string) => (iso ? new Date(iso).toISOString().slice(11, 16) : "");

function parse(cursor: string): CursorState | undefined {
	try {
		const j = JSON.parse(cursor) as CursorState;
		return typeof j.sync === "string" ? { sync: j.sync, reminded: j.reminded ?? {} } : undefined;
	} catch {
		return undefined;
	}
}

async function initial(ctx: SourceCtx<Config>): Promise<string> {
	const now = ctx.deps.now();
	const { syncToken } = await listAll(ctx, {
		timeMin: now.toISOString(),
		timeMax: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
		singleEvents: "true",
		maxResults: "250",
	});
	if (!syncToken) throw new Error("Calendar returned no sync token");
	return JSON.stringify({ sync: syncToken, reminded: {} } satisfies CursorState);
}

function changeEvent(e: CalEvent): NewEvent {
	const title = e.summary ?? "(no title)";
	let verb: string;
	if (e.status === "cancelled") verb = "cancelled";
	else {
		const c = e.created ? new Date(e.created).getTime() : 0;
		const u = e.updated ? new Date(e.updated).getTime() : 0;
		verb = Math.abs(u - c) < 60_000 ? "added" : "changed";
	}
	const when = e.start?.dateTime ?? e.start?.date ?? "";
	return {
		title: `Event ${verb}: ${title}`,
		body: [when, e.location].filter(Boolean).join(" · "),
		facts: { eventId: e.id, summary: title, start: when, change: verb },
		dedupeKey: `${e.id}:${verb}:${e.updated ?? ""}`,
		importanceHint: "normal",
		occurredAt: e.updated ?? ctxNowFallback(),
	};
}
const ctxNowFallback = () => new Date().toISOString();

export const googleCalendarSource: WatcherSource<Config> = {
	type: "google-calendar",
	label: "Google Calendar",
	requires: { connectionType: "google", feature: "calendar" },
	configSchema,
	defaultIntervalSec: 60,
	minIntervalSec: 30,
	async poll(ctx, cursor) {
		const state = cursor ? parse(cursor) : undefined;
		if (!state) return { events: [], cursor: await initial(ctx) };

		const events: NewEvent[] = [];
		let sync = state.sync;
		try {
			const { items, syncToken } = await listAll(ctx, { syncToken: state.sync, maxResults: "250" });
			for (const e of items) events.push(changeEvent(e));
			if (syncToken) sync = syncToken;
		} catch (e) {
			if (!(e instanceof SyncExpired)) throw e;
			const fresh = parse(await initial(ctx));
			sync = fresh?.sync ?? sync;
		}

		// Reminders: next 24 h, once per (eventId, minutes).
		const now = ctx.deps.now();
		const nowMs = now.getTime();
		const reminded: Record<string, number> = {};
		for (const [k, v] of Object.entries(state.reminded)) if (v > nowMs) reminded[k] = v;
		const upcoming = await listAll(ctx, {
			timeMin: now.toISOString(),
			timeMax: new Date(nowMs + 86_400_000).toISOString(),
			singleEvents: "true",
			orderBy: "startTime",
			maxResults: "100",
		});
		for (const e of upcoming.items) {
			const s = startMs(e);
			if (Number.isNaN(s) || s <= nowMs || e.status === "cancelled") continue;
			for (const m of ctx.config.remindMinutes ?? [15]) {
				const key = `${e.id}|${m}`;
				if (reminded[key] !== undefined || s - nowMs > m * 60_000) continue;
				reminded[key] = s;
				const title = e.summary ?? "(no title)";
				events.push({
					title: `"${title}" starts in ${m} min`,
					body: [e.description?.slice(0, 500), e.location].filter(Boolean).join("\n"),
					facts: {
						eventId: e.id,
						summary: title,
						start: e.start?.dateTime ?? "",
						end: e.end?.dateTime ?? "",
						...(e.hangoutLink ? { meetLink: e.hangoutLink } : {}),
					},
					dedupeKey: `${e.id}:remind:${m}:${s}`,
					importanceHint: "high",
					occurredAt: now.toISOString(),
				});
			}
		}
		return { events, cursor: JSON.stringify({ sync, reminded } satisfies CursorState) };
	},
	async test(ctx) {
		try {
			const now = ctx.deps.now();
			const r = await list(ctx, {
				timeMin: now.toISOString(),
				timeMax: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
				singleEvents: "true",
				orderBy: "startTime",
				maxResults: "3",
			});
			const sample = (r.items ?? []).slice(0, 3).map((e) => ({
				title: e.summary ?? "(no title)",
				body: `${e.start?.dateTime ?? e.start?.date ?? ""} ${hhmm(e.start?.dateTime)}`.trim(),
				facts: { eventId: e.id },
				dedupeKey: e.id,
				importanceHint: "low" as const,
				occurredAt: now.toISOString(),
			}));
			return { ok: true, message: `Connected. ${sample.length} upcoming event(s).`, sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
