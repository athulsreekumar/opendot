// Gmail tools. Spec 05 §5.1.
import type { ToolDefinition } from "../../runtime/pi-adapter";
import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { DESTRUCTIVE, googleFetch, READ_ONLY, textResult, WRITE } from "./client";

export const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailPart {
	mimeType?: string;
	body?: { data?: string; size?: number };
	parts?: GmailPart[];
	filename?: string;
}
export interface GmailMessage {
	id: string;
	threadId?: string;
	snippet?: string;
	payload?: GmailPart & { headers?: Array<{ name: string; value: string }> };
}

export function header(m: GmailMessage, name: string): string {
	return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function decodeB64Url(data: string): string {
	return Buffer.from(data, "base64url").toString("utf8");
}

function findPart(part: GmailPart | undefined, mime: string): string | undefined {
	if (!part) return undefined;
	if (part.mimeType === mime && part.body?.data && !part.filename) return decodeB64Url(part.body.data);
	for (const p of part.parts ?? []) {
		const r = findPart(p, mime);
		if (r !== undefined) return r;
	}
	return undefined;
}

export function stripHtml(html: string): string {
	return html
		.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
		.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function messageText(m: GmailMessage): string {
	const plain = findPart(m.payload, "text/plain");
	if (plain !== undefined) return plain.trim();
	const html = findPart(m.payload, "text/html");
	if (html !== undefined) return stripHtml(html);
	return m.snippet ?? "";
}

function encodeHeader(v: string): string {
	return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

export function buildRaw(a: { to: string; subject: string; body: string; cc?: string }): string {
	const lines = [`To: ${a.to}`];
	if (a.cc) lines.push(`Cc: ${a.cc}`);
	lines.push(
		`Subject: ${encodeHeader(a.subject)}`,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		a.body,
	);
	return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export function gmailTools(deps: NativeToolDeps): ToolDefinition[] {
	const search = defineTool({
		name: "gmail_search",
		label: "Gmail · search",
		description:
			"Search Gmail with Gmail query syntax (e.g. 'from:priya is:unread'). Returns subject, sender, date and message id.",
		parameters: Type.Object({
			query: Type.String({ description: "Gmail search query" }),
			max: Type.Optional(Type.Number({ description: "Max results (default 10, up to 25)" })),
		}),
		annotations: READ_ONLY,
		async execute(_id, params) {
			const max = Math.min(Math.max(Math.floor(params.max ?? 10), 1), 25);
			const list = (await googleFetch(
				deps,
				`${GMAIL_BASE}/messages?q=${encodeURIComponent(params.query)}&maxResults=${max}`,
			)) as { messages?: Array<{ id: string }> };
			const ids = (list.messages ?? []).map((m) => m.id);
			if (ids.length === 0) return textResult("No messages found.", { count: 0, items: [] });
			const msgs = await Promise.all(
				ids.map(
					(id) =>
						googleFetch(
							deps,
							`${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
						) as Promise<GmailMessage>,
				),
			);
			const items = msgs.map((m) => ({
				id: m.id,
				subject: header(m, "Subject") || "(no subject)",
				from: header(m, "From"),
				date: header(m, "Date"),
			}));
			const text = items.map((m, i) => `${i + 1}. ${m.subject} — ${m.from} — ${m.date} — ${m.id}`).join("\n");
			return textResult(text, { count: items.length, items });
		},
	});

	const read = defineTool({
		name: "gmail_read",
		label: "Gmail · read",
		description: "Read one Gmail message by id (plain-text body).",
		parameters: Type.Object({ id: Type.String({ description: "Message id from gmail_search" }) }),
		annotations: READ_ONLY,
		async execute(_id, params) {
			const m = (await googleFetch(
				deps,
				`${GMAIL_BASE}/messages/${encodeURIComponent(params.id)}?format=full`,
			)) as GmailMessage;
			const head = [
				`From: ${header(m, "From")}`,
				`To: ${header(m, "To")}`,
				header(m, "Cc") ? `Cc: ${header(m, "Cc")}` : "",
				`Date: ${header(m, "Date")}`,
				`Subject: ${header(m, "Subject")}`,
			]
				.filter(Boolean)
				.join("\n");
			return textResult(`${head}\n\n${messageText(m)}`, { id: m.id, threadId: m.threadId });
		},
	});

	const createDraft = defineTool({
		name: "gmail_create_draft",
		label: "Gmail · create draft",
		description: "Create a Gmail draft (does not send). Returns the draft id for gmail_send_draft.",
		parameters: Type.Object({
			to: Type.String({ description: "Recipient address(es), comma separated" }),
			subject: Type.String(),
			body: Type.String({ description: "Plain-text body" }),
			cc: Type.Optional(Type.String()),
			threadId: Type.Optional(Type.String({ description: "Reply within this thread" })),
		}),
		annotations: WRITE,
		async execute(_id, params) {
			const message: Record<string, string> = { raw: buildRaw(params) };
			if (params.threadId) message.threadId = params.threadId;
			const d = (await googleFetch(deps, `${GMAIL_BASE}/drafts`, {
				method: "POST",
				body: JSON.stringify({ message }),
			})) as { id: string };
			return textResult(`Draft created (id ${d.id}) to ${params.to}: "${params.subject}"`, { draftId: d.id });
		},
	});

	const sendDraft = defineTool({
		name: "gmail_send_draft",
		label: "Gmail · send draft",
		description: "Send an existing Gmail draft. This sends the email for real.",
		parameters: Type.Object({ draftId: Type.String() }),
		annotations: DESTRUCTIVE,
		async execute(_id, params) {
			const r = (await googleFetch(deps, `${GMAIL_BASE}/drafts/send`, {
				method: "POST",
				body: JSON.stringify({ id: params.draftId }),
			})) as { id?: string; threadId?: string };
			return textResult(`Sent message ${r.id ?? ""}`.trim(), { messageId: r.id, threadId: r.threadId });
		},
	});

	return [search, read, createDraft, sendDraft] as unknown as ToolDefinition[];
}
