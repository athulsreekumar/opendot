import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { graphJson, oneLine, stripHtml, textResult } from "./client";

interface Chat {
	id: string;
	topic?: string | null;
	chatType?: string;
	lastUpdatedDateTime?: string;
}
export interface ChatMessage {
	id: string;
	createdDateTime?: string;
	messageType?: string;
	from?: { user?: { displayName?: string } | null; application?: { displayName?: string } | null } | null;
	body?: { contentType?: string; content?: string };
}

export function messageText(m: ChatMessage): string {
	const raw = m.body?.content ?? "";
	return m.body?.contentType === "html" ? stripHtml(raw) : raw;
}

export function messageSender(m: ChatMessage): string {
	return m.from?.user?.displayName ?? m.from?.application?.displayName ?? "system";
}

export function teamsTools(deps: NativeToolDeps) {
	const list = defineTool({
		name: "teams_list_chats",
		label: "Teams · list chats",
		description: "List your recent Teams chats. Returns: n. topic or type — updated — chatId.",
		parameters: Type.Object({}),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute() {
			const data = await graphJson<{ value: Chat[] }>(
				deps,
				"/me/chats?$top=30&$orderby=lastMessagePreview/createdDateTime desc",
			);
			const items = data.value ?? [];
			const text = items.length
				? items
						.map(
							(c, i) =>
								`${i + 1}. ${c.topic || `${c.chatType ?? "chat"} chat`} — ${c.lastUpdatedDateTime ?? ""} — ${c.id}`,
						)
						.join("\n")
				: "No chats found.";
			return textResult(text, { count: items.length });
		},
	});

	const read = defineTool({
		name: "teams_read_chat",
		label: "Teams · read chat",
		description: "Read the latest messages of a Teams chat (newest first).",
		parameters: Type.Object({
			chatId: Type.String(),
			top: Type.Optional(Type.Number({ description: "Max messages (default 20)", minimum: 1, maximum: 50 })),
		}),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, p) {
			const top = p.top ?? 20;
			const data = await graphJson<{ value: ChatMessage[] }>(
				deps,
				`/me/chats/${encodeURIComponent(p.chatId)}/messages?$top=${top}&$orderby=${encodeURIComponent("createdDateTime desc")}`,
			);
			const items = (data.value ?? []).filter((m) => m.messageType === undefined || m.messageType === "message");
			const text = items.length
				? items
						.map((m) => `[${m.createdDateTime ?? ""}] ${messageSender(m)}: ${oneLine(messageText(m), 500)}`)
						.join("\n")
				: "No messages.";
			return textResult(text, { count: items.length });
		},
	});

	const send = defineTool({
		name: "teams_send_chat_message",
		label: "Teams · send message",
		description: "Send a message to a Teams chat. This cannot be undone.",
		parameters: Type.Object({ chatId: Type.String(), text: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
		async execute(_id, p) {
			const m = await graphJson<ChatMessage>(deps, `/me/chats/${encodeURIComponent(p.chatId)}/messages`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ body: { contentType: "text", content: p.text } }),
			});
			return textResult(`Message sent (id: ${m.id}).`, { id: m.id });
		},
	});

	return [list, read, send];
}
