// Teams chat watcher (spec 12 §4): per-chat polling, cursor = JSON {chatId: lastCreatedDateTime}.
import { z } from "zod";
import { graphJson, oneLine } from "../../connections/microsoft/client";
import { type ChatMessage, messageSender, messageText } from "../../connections/microsoft/teams";
import type { NewEvent, WatcherSource } from "../types";
import { graphDeps } from "./outlook-mail";

const configSchema = z.object({ chatIds: z.array(z.string()).default([]) });
type Config = z.infer<typeof configSchema>;

const msgsUrl = (chatId: string) =>
	`/me/chats/${encodeURIComponent(chatId)}/messages?$top=20&$orderby=${encodeURIComponent("createdDateTime desc")}`;

const isReal = (m: ChatMessage) => (m.messageType === undefined || m.messageType === "message") && !!m.createdDateTime;

function parse(cursor: string | undefined): Record<string, string> {
	if (!cursor) return {};
	try {
		const o = JSON.parse(cursor);
		return o && typeof o === "object" ? (o as Record<string, string>) : {};
	} catch {
		return {};
	}
}

function toEvent(m: ChatMessage, chatId: string, chatName: string): NewEvent {
	const from = messageSender(m);
	const text = messageText(m);
	return {
		title: `${from} in ${chatName}: ${oneLine(text, 120)}`,
		body: text,
		facts: { from, chatId, messageId: m.id, chat: chatName },
		dedupeKey: `${chatId}:${m.id}`,
		importanceHint: "normal",
		occurredAt: m.createdDateTime ?? new Date().toISOString(),
	};
}

export const teamsChatSource: WatcherSource<Config> = {
	type: "teams-chat",
	label: "Teams chat",
	requires: { connectionType: "microsoft", feature: "teams" },
	configSchema,
	defaultIntervalSec: 30,
	minIntervalSec: 15,
	async poll(ctx, cursor) {
		const g = graphDeps(ctx.deps);
		const state = parse(cursor);
		const next: Record<string, string> = {};
		const events: NewEvent[] = [];
		let failures = 0;
		let firstError: unknown;
		for (const chatId of ctx.config.chatIds) {
			const last = state[chatId];
			try {
				const data = await graphJson<{ value?: ChatMessage[] }>(g, msgsUrl(chatId));
				const msgs = (data.value ?? []).filter(isReal);
				const newest = msgs.reduce<string | undefined>(
					(a, m) => (!a || (m.createdDateTime ?? "") > a ? m.createdDateTime : a),
					undefined,
				);
				if (!last) {
					// First time we see this chat: baseline silently.
					next[chatId] = newest ?? ctx.deps.now().toISOString();
					continue;
				}
				const fresh = msgs.filter((m) => (m.createdDateTime ?? "") > last).reverse();
				next[chatId] = newest && newest > last ? newest : last;
				if (fresh.length === 0) continue;
				let name = "chat";
				try {
					const chat = await graphJson<{ topic?: string | null }>(g, `/me/chats/${encodeURIComponent(chatId)}`);
					if (chat.topic) name = `${chat.topic} chat`;
				} catch {
					// keep the generic name
				}
				for (const m of fresh) events.push(toEvent(m, chatId, name));
			} catch (e) {
				failures++;
				firstError ??= e;
				ctx.deps.log.warn("teams-chat poll failed for a chat", e instanceof Error ? e.message : String(e));
				if (last) next[chatId] = last;
			}
		}
		if (failures > 0 && failures === ctx.config.chatIds.length) throw firstError;
		return { events, cursor: JSON.stringify(next) };
	},
	async test(ctx) {
		const [chatId] = ctx.config.chatIds;
		if (!chatId) return { ok: false, message: "Pick at least one chat to watch.", sample: [] };
		try {
			const data = await graphJson<{ value?: ChatMessage[] }>(graphDeps(ctx.deps), msgsUrl(chatId));
			const sample = (data.value ?? [])
				.filter(isReal)
				.slice(0, 3)
				.map((m) => toEvent(m, chatId, "chat"));
			return { ok: true, message: `Connected. ${sample.length} recent message(s).`, sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
