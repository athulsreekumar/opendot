// Google Calendar tools. Spec 05 §5.1.
import type { ToolDefinition } from "../../runtime/pi-adapter";
import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { DESTRUCTIVE, googleFetch, READ_ONLY, textResult, WRITE } from "./client";

export const CAL_BASE = "https://www.googleapis.com/calendar/v3";

interface CalEvent {
	id: string;
	summary?: string;
	location?: string;
	status?: string;
	start?: { dateTime?: string; date?: string };
	end?: { dateTime?: string; date?: string };
	attendees?: Array<{ email: string }>;
	htmlLink?: string;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const when = (t?: { dateTime?: string; date?: string }) => t?.dateTime ?? t?.date ?? "?";

function timeObj(iso: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { date: iso } : { dateTime: iso, timeZone: tz() };
}
const toIso = (s: string) => new Date(s).toISOString();

export function calendarTools(deps: NativeToolDeps): ToolDefinition[] {
	const list = defineTool({
		name: "calendar_list_events",
		label: "Calendar · list events",
		description: "List calendar events between two ISO 8601 times.",
		parameters: Type.Object({
			from: Type.String({ description: "ISO 8601 start" }),
			to: Type.String({ description: "ISO 8601 end" }),
			calendarId: Type.Optional(Type.String({ description: 'Default "primary"' })),
		}),
		annotations: READ_ONLY,
		async execute(_id, p) {
			const cal = encodeURIComponent(p.calendarId ?? "primary");
			const q = new URLSearchParams({
				timeMin: toIso(p.from),
				timeMax: toIso(p.to),
				singleEvents: "true",
				orderBy: "startTime",
				maxResults: "50",
			});
			const r = (await googleFetch(deps, `${CAL_BASE}/calendars/${cal}/events?${q}`)) as { items?: CalEvent[] };
			const items = r.items ?? [];
			if (items.length === 0) return textResult("No events in that range.", { count: 0, items: [] });
			const text = items
				.map((e, i) => `${i + 1}. ${e.summary ?? "(no title)"} — ${when(e.start)} to ${when(e.end)} — ${e.id}`)
				.join("\n");
			return textResult(text, { count: items.length, items });
		},
	});

	const create = defineTool({
		name: "calendar_create_event",
		label: "Calendar · create event",
		description: "Create a calendar event on the primary calendar.",
		parameters: Type.Object({
			summary: Type.String(),
			start: Type.String({ description: "ISO 8601 start" }),
			end: Type.String({ description: "ISO 8601 end" }),
			attendees: Type.Optional(Type.Array(Type.String({ description: "Email" }))),
			location: Type.Optional(Type.String()),
			description: Type.Optional(Type.String()),
		}),
		annotations: WRITE,
		async execute(_id, p) {
			const body: Record<string, unknown> = { summary: p.summary, start: timeObj(p.start), end: timeObj(p.end) };
			if (p.attendees?.length) body.attendees = p.attendees.map((email) => ({ email }));
			if (p.location) body.location = p.location;
			if (p.description) body.description = p.description;
			const e = (await googleFetch(deps, `${CAL_BASE}/calendars/primary/events`, {
				method: "POST",
				body: JSON.stringify(body),
			})) as CalEvent;
			return textResult(`Created "${e.summary}" (${when(e.start)}) — id ${e.id}`, { id: e.id, link: e.htmlLink });
		},
	});

	const update = defineTool({
		name: "calendar_update_event",
		label: "Calendar · update event",
		description: "Change fields of an existing event. Only the fields you pass are changed.",
		parameters: Type.Object({
			id: Type.String(),
			summary: Type.Optional(Type.String()),
			start: Type.Optional(Type.String()),
			end: Type.Optional(Type.String()),
			attendees: Type.Optional(Type.Array(Type.String())),
			location: Type.Optional(Type.String()),
			description: Type.Optional(Type.String()),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		async execute(_id, p) {
			const body: Record<string, unknown> = {};
			if (p.summary !== undefined) body.summary = p.summary;
			if (p.start) body.start = timeObj(p.start);
			if (p.end) body.end = timeObj(p.end);
			if (p.attendees) body.attendees = p.attendees.map((email) => ({ email }));
			if (p.location !== undefined) body.location = p.location;
			if (p.description !== undefined) body.description = p.description;
			const e = (await googleFetch(deps, `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(p.id)}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			})) as CalEvent;
			return textResult(`Updated "${e.summary ?? p.id}" (${when(e.start)})`, { id: e.id });
		},
	});

	const del = defineTool({
		name: "calendar_delete_event",
		label: "Calendar · delete event",
		description: "Delete a calendar event by id.",
		parameters: Type.Object({ id: Type.String() }),
		annotations: DESTRUCTIVE,
		async execute(_id, p) {
			await googleFetch(deps, `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(p.id)}`, { method: "DELETE" });
			return textResult(`Deleted event ${p.id}`, { id: p.id });
		},
	});

	const freeBusy = defineTool({
		name: "calendar_free_busy",
		label: "Calendar · free/busy",
		description: "List busy intervals on the primary calendar between two ISO 8601 times.",
		parameters: Type.Object({ from: Type.String(), to: Type.String() }),
		annotations: READ_ONLY,
		async execute(_id, p) {
			const r = (await googleFetch(deps, `${CAL_BASE}/freeBusy`, {
				method: "POST",
				body: JSON.stringify({ timeMin: toIso(p.from), timeMax: toIso(p.to), items: [{ id: "primary" }] }),
			})) as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> };
			const busy = r.calendars?.primary?.busy ?? [];
			if (busy.length === 0) return textResult("Free for the whole range.", { busy: [] });
			return textResult(busy.map((b, i) => `${i + 1}. busy ${b.start} to ${b.end}`).join("\n"), { busy });
		},
	});

	return [list, create, update, del, freeBusy] as unknown as ToolDefinition[];
}
