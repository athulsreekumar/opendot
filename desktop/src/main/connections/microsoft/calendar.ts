import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { graphJson, oneLine, textResult } from "./client";

interface GraphEvent {
	id: string;
	subject?: string;
	start?: { dateTime: string; timeZone?: string };
	end?: { dateTime: string; timeZone?: string };
	location?: { displayName?: string };
	attendees?: Array<{ emailAddress?: { address?: string } }>;
	isCancelled?: boolean;
}

/** Accept ISO 8601. With an offset/Z → convert to UTC; without → system timezone. */
function graphTime(iso: string, tz?: string): { dateTime: string; timeZone: string } {
	if (/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
		return { dateTime: d.toISOString().replace(/Z$/, ""), timeZone: "UTC" };
	}
	return { dateTime: iso, timeZone: tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function calendarTools(deps: NativeToolDeps) {
	const eventFields = {
		subject: Type.String({ description: "Event title" }),
		start: Type.String({ description: "ISO 8601 start" }),
		end: Type.String({ description: "ISO 8601 end" }),
		attendees: Type.Optional(Type.Array(Type.String(), { description: "Attendee email addresses" })),
		location: Type.Optional(Type.String()),
		body: Type.Optional(Type.String({ description: "Description" })),
		timeZone: Type.Optional(Type.String({ description: "IANA/Windows timezone for start/end without an offset" })),
	};

	const list = defineTool({
		name: "outlook_list_events",
		label: "Outlook · list events",
		description: "List calendar events between two ISO 8601 times. Returns: n. subject — start → end — location — id.",
		parameters: Type.Object({ from: Type.String(), to: Type.String() }),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, params) {
			const f = graphTime(params.from);
			const t = graphTime(params.to);
			const qs = `startDateTime=${encodeURIComponent(f.dateTime + (f.timeZone === "UTC" ? "Z" : ""))}&endDateTime=${encodeURIComponent(t.dateTime + (t.timeZone === "UTC" ? "Z" : ""))}`;
			const data = await graphJson<{ value: GraphEvent[] }>(
				deps,
				`/me/calendarView?${qs}&$orderby=start/dateTime&$top=50&$select=id,subject,start,end,location,isCancelled`,
				{ headers: { Prefer: 'outlook.timezone="UTC"' } },
			);
			const items = (data.value ?? []).filter((e) => !e.isCancelled);
			const text = items.length
				? items
						.map(
							(e, i) =>
								`${i + 1}. ${oneLine(e.subject, 100)} — ${e.start?.dateTime ?? ""}Z → ${e.end?.dateTime ?? ""}Z${e.location?.displayName ? ` — ${e.location.displayName}` : ""} — ${e.id}`,
						)
						.join("\n")
				: "No events in that range.";
			return textResult(text, { count: items.length });
		},
	});

	const create = defineTool({
		name: "outlook_create_event",
		label: "Outlook · create event",
		description: "Create a calendar event. Attendees (if any) receive invitations.",
		parameters: Type.Object(eventFields),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		async execute(_id, p) {
			const ev = await graphJson<GraphEvent>(deps, "/me/events", {
				method: "POST",
				headers: JSON_HEADERS,
				body: JSON.stringify({
					subject: p.subject,
					start: graphTime(p.start, p.timeZone),
					end: graphTime(p.end, p.timeZone),
					...(p.location ? { location: { displayName: p.location } } : {}),
					...(p.body ? { body: { contentType: "text", content: p.body } } : {}),
					...(p.attendees?.length
						? { attendees: p.attendees.map((address) => ({ emailAddress: { address }, type: "required" })) }
						: {}),
				}),
			});
			return textResult(`Event created: ${p.subject} (id: ${ev.id})`, { id: ev.id });
		},
	});

	const update = defineTool({
		name: "outlook_update_event",
		label: "Outlook · update event",
		description: "Update fields of a calendar event. Only the fields you pass change.",
		parameters: Type.Object({
			id: Type.String(),
			subject: Type.Optional(Type.String()),
			start: Type.Optional(Type.String()),
			end: Type.Optional(Type.String()),
			attendees: Type.Optional(Type.Array(Type.String())),
			location: Type.Optional(Type.String()),
			body: Type.Optional(Type.String()),
			timeZone: Type.Optional(Type.String()),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
		async execute(_id, p) {
			const patch: Record<string, unknown> = {};
			if (p.subject !== undefined) patch.subject = p.subject;
			if (p.start !== undefined) patch.start = graphTime(p.start, p.timeZone);
			if (p.end !== undefined) patch.end = graphTime(p.end, p.timeZone);
			if (p.location !== undefined) patch.location = { displayName: p.location };
			if (p.body !== undefined) patch.body = { contentType: "text", content: p.body };
			if (p.attendees !== undefined)
				patch.attendees = p.attendees.map((address) => ({ emailAddress: { address }, type: "required" }));
			if (Object.keys(patch).length === 0) throw new Error("Nothing to update: pass at least one field.");
			await graphJson(deps, `/me/events/${encodeURIComponent(p.id)}`, {
				method: "PATCH",
				headers: JSON_HEADERS,
				body: JSON.stringify(patch),
			});
			return textResult(`Event updated (id: ${p.id}).`, { id: p.id });
		},
	});

	const del = defineTool({
		name: "outlook_delete_event",
		label: "Outlook · delete event",
		description: "Delete a calendar event. Cancels it for attendees; cannot be undone.",
		parameters: Type.Object({ id: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
		async execute(_id, p) {
			await graphJson(deps, `/me/events/${encodeURIComponent(p.id)}`, { method: "DELETE" });
			return textResult(`Event deleted (id: ${p.id}).`, { id: p.id });
		},
	});

	return [list, create, update, del];
}
