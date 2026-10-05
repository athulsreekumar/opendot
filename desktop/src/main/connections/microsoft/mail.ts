import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { graphJson, oneLine, stripHtml, textResult } from "./client";

interface GraphMessage {
	id: string;
	subject?: string;
	from?: { emailAddress?: { name?: string; address?: string } };
	toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
	receivedDateTime?: string;
	bodyPreview?: string;
	body?: { contentType?: string; content?: string };
}

const SELECT = "id,subject,from,receivedDateTime,bodyPreview";

function sender(m: GraphMessage): string {
	const a = m.from?.emailAddress;
	return a?.name || a?.address || "unknown";
}

export function mailTools(deps: NativeToolDeps) {
	const search = defineTool({
		name: "outlook_search",
		label: "Outlook · search",
		description: "Search Outlook mail. Returns a numbered list: subject — from — date — id.",
		parameters: Type.Object({
			query: Type.String({ description: "Search text (KQL allowed, e.g. from:sam subject:budget)" }),
			top: Type.Optional(Type.Number({ description: "Max results (default 10)", minimum: 1, maximum: 50 })),
		}),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, params) {
			const top = params.top ?? 10;
			const q = params.query.replace(/"/g, " ");
			const data = await graphJson<{ value: GraphMessage[] }>(
				deps,
				`/me/messages?$search=${encodeURIComponent(`"${q}"`)}&$top=${top}&$select=${SELECT}`,
				{ headers: { ConsistencyLevel: "eventual" } },
			);
			const items = data.value ?? [];
			const text = items.length
				? items
						.map(
							(m, i) =>
								`${i + 1}. ${oneLine(m.subject, 100) || "(no subject)"} — ${sender(m)} — ${m.receivedDateTime ?? ""} — ${m.id}`,
						)
						.join("\n")
				: "No messages found.";
			return textResult(text, { count: items.length });
		},
	});

	const read = defineTool({
		name: "outlook_read",
		label: "Outlook · read",
		description: "Read one Outlook message (headers and plain-text body) by id.",
		parameters: Type.Object({ id: Type.String({ description: "Message id from outlook_search" }) }),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, params) {
			const m = await graphJson<GraphMessage>(
				deps,
				`/me/messages/${encodeURIComponent(params.id)}?$select=id,subject,from,toRecipients,receivedDateTime,body`,
			);
			const raw = m.body?.content ?? "";
			const body = m.body?.contentType === "html" ? stripHtml(raw) : raw;
			const to = (m.toRecipients ?? [])
				.map((r) => r.emailAddress?.address)
				.filter(Boolean)
				.join(", ");
			const text = `From: ${sender(m)}\nTo: ${to}\nDate: ${m.receivedDateTime ?? ""}\nSubject: ${m.subject ?? ""}\n\n${body}`;
			return textResult(text, { id: m.id });
		},
	});

	const createDraft = defineTool({
		name: "outlook_create_draft",
		label: "Outlook · create draft",
		description: "Create a draft email (not sent). Returns the draft id for outlook_send_draft.",
		parameters: Type.Object({
			to: Type.Array(Type.String(), { description: "Recipient email addresses" }),
			subject: Type.String(),
			body: Type.String({ description: "Plain-text body" }),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		async execute(_id, params) {
			const draft = await graphJson<GraphMessage>(deps, "/me/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					subject: params.subject,
					body: { contentType: "text", content: params.body },
					toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
				}),
			});
			return textResult(`Draft created (id: ${draft.id}). Not sent yet.`, { id: draft.id });
		},
	});

	const sendDraft = defineTool({
		name: "outlook_send_draft",
		label: "Outlook · send draft",
		description: "Send an existing draft email. This cannot be undone.",
		parameters: Type.Object({ id: Type.String({ description: "Draft id from outlook_create_draft" }) }),
		annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
		async execute(_id, params) {
			await graphJson(deps, `/me/messages/${encodeURIComponent(params.id)}/send`, { method: "POST" });
			return textResult("Draft sent.", { id: params.id });
		},
	});

	return [search, read, createDraft, sendDraft];
}
