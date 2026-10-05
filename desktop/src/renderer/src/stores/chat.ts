// Chat state per Dot, fed by "dot:event" (spec 02 §3.5, spec 14 §4).
import type { ChatEvent, ChatMessageView, DotId, MessageId } from "@shared/types";
import { create } from "zustand";
import { api, errorText } from "../lib/api";

export interface DotChat {
	byId: Record<MessageId, ChatMessageView>;
	order: MessageId[];
	hasMore: boolean;
	loading: boolean;
	loaded: boolean;
	/** Streaming bookkeeping per message. */
	seq: Record<MessageId, number>;
	needsResync: Record<MessageId, boolean>;
	/** client nonce → local message id */
	pendingNonces: Record<string, MessageId>;
}

const emptyChat = (): DotChat => ({
	byId: {},
	order: [],
	hasMore: false,
	loading: false,
	loaded: false,
	seq: {},
	needsResync: {},
	pendingNonces: {},
});

interface ChatState {
	byDot: Record<string, DotChat>;
	loadHistory(dotId: DotId, force?: boolean): Promise<void>;
	loadMore(dotId: DotId): Promise<void>;
	send(dotId: DotId, text: string, mode?: "auto" | "steer" | "followUp"): Promise<void>;
	abort(dotId: DotId): Promise<void>;
	clear(dotId: DotId): Promise<void>;
	apply(e: ChatEvent): void;
	/** Visible messages in order (hidden ones dropped). */
	messages(dotId: DotId): ChatMessageView[];
}

function put(chat: DotChat, m: ChatMessageView, replaceId?: MessageId): DotChat {
	const byId = { ...chat.byId };
	let order = chat.order;
	if (replaceId && byId[replaceId]) {
		delete byId[replaceId];
		order = order.map((id) => (id === replaceId ? m.id : id));
	} else if (!byId[m.id]) {
		order = [...order, m.id];
	}
	byId[m.id] = m;
	return { ...chat, byId, order };
}

function updateMsg(chat: DotChat, id: MessageId, fn: (m: ChatMessageView) => ChatMessageView): DotChat {
	const m = chat.byId[id];
	if (!m) return chat;
	return { ...chat, byId: { ...chat.byId, [id]: fn(m) } };
}

export function reduceChat(chat: DotChat, e: ChatEvent): DotChat {
	switch (e.type) {
		case "message-start": {
			const local = e.clientNonce ? chat.pendingNonces[e.clientNonce] : undefined;
			let next = put(chat, e.message, local);
			if (e.clientNonce) {
				const pn = { ...next.pendingNonces };
				delete pn[e.clientNonce];
				next = { ...next, pendingNonces: pn };
			}
			return { ...next, seq: { ...next.seq, [e.message.id]: 0 } };
		}
		case "message-delta": {
			const last = chat.seq[e.messageId] ?? 0;
			if (e.seq <= last || chat.needsResync[e.messageId]) return chat;
			if (e.seq !== last + 1) return { ...chat, needsResync: { ...chat.needsResync, [e.messageId]: true } };
			const next = updateMsg(chat, e.messageId, (m) => ({
				...m,
				text: m.text + (e.text ?? ""),
				thinking: e.thinking ? (m.thinking ?? "") + e.thinking : m.thinking,
			}));
			return { ...next, seq: { ...next.seq, [e.messageId]: e.seq } };
		}
		case "message-update": {
			const last = chat.seq[e.messageId] ?? 0;
			if (e.seq < last) return chat;
			const next = updateMsg(chat, e.messageId, (m) => ({ ...m, text: e.text, thinking: e.thinking ?? m.thinking }));
			const nr = { ...next.needsResync };
			delete nr[e.messageId];
			return { ...next, seq: { ...next.seq, [e.messageId]: e.seq }, needsResync: nr };
		}
		case "message-end": {
			const prev = chat.byId[e.message.id];
			const merged: ChatMessageView = {
				...e.message,
				toolCalls: e.message.toolCalls.length ? e.message.toolCalls : (prev?.toolCalls ?? []),
				peerStreams: prev?.peerStreams ?? e.message.peerStreams,
			};
			return put(chat, merged);
		}
		case "tool-start":
		case "tool-update": {
			return updateMsg(chat, e.messageId, (m) => {
				const i = m.toolCalls.findIndex((t) => t.id === e.tool.id);
				const prev = i >= 0 ? m.toolCalls[i] : undefined;
				const tool = {
					...e.tool,
					argsPreview: e.tool.status === "preparing" ? (prev?.argsPreview ?? e.tool.argsPreview) : undefined,
				};
				const toolCalls = i >= 0 ? m.toolCalls.map((t, j) => (j === i ? tool : t)) : [...m.toolCalls, tool];
				return { ...m, toolCalls };
			});
		}
		case "tool-args-delta":
			return updateMsg(chat, e.messageId, (m) => ({
				...m,
				toolCalls: m.toolCalls.map((t) =>
					t.id === e.toolCallId ? { ...t, argsPreview: (t.argsPreview ?? "") + e.delta } : t,
				),
			}));
		case "peer-stream":
			return updateMsg(chat, e.messageId, (m) => {
				const streams = { ...(m.peerStreams ?? {}) };
				const forTool = { ...(streams[e.toolCallId] ?? {}) };
				const cur = forTool[e.peerDotId] ?? { peerDotId: e.peerDotId, status: "queued" as const, text: "", seq: 0 };
				if (e.seq <= cur.seq) return m;
				forTool[e.peerDotId] = {
					...cur,
					status: e.status,
					text: e.text !== undefined ? e.text : cur.text + (e.delta ?? ""),
					error: e.error ?? cur.error,
					seq: e.seq,
				};
				streams[e.toolCallId] = forTool;
				return { ...m, peerStreams: streams };
			});
		default:
			return chat;
	}
}

export const useChat = create<ChatState>((set, get) => ({
	byDot: {},

	async loadHistory(dotId, force = false) {
		const cur = get().byDot[dotId];
		if (cur?.loading || (cur?.loaded && !force)) return;
		set((s) => ({ byDot: { ...s.byDot, [dotId]: { ...(s.byDot[dotId] ?? emptyChat()), loading: true } } }));
		try {
			const { messages, hasMore } = await api.chat.history(dotId, { limit: 80 });
			set((s) => {
				const prev = s.byDot[dotId] ?? emptyChat();
				// Keep live streaming messages that history doesn't have yet.
				const live = prev.order.map((id) => prev.byId[id]!).filter((m) => m?.streaming);
				const byId: Record<string, ChatMessageView> = {};
				const order: string[] = [];
				for (const m of [...messages, ...live]) {
					if (!byId[m.id]) order.push(m.id);
					byId[m.id] = m;
				}
				return { byDot: { ...s.byDot, [dotId]: { ...prev, byId, order, hasMore, loading: false, loaded: true } } };
			});
		} catch {
			set((s) => ({ byDot: { ...s.byDot, [dotId]: { ...(s.byDot[dotId] ?? emptyChat()), loading: false } } }));
		}
	},

	async loadMore(dotId) {
		const cur = get().byDot[dotId];
		if (!cur || cur.loading || !cur.hasMore) return;
		const first = cur.order[0];
		set((s) => ({ byDot: { ...s.byDot, [dotId]: { ...cur, loading: true } } }));
		const { messages, hasMore } = await api.chat.history(dotId, { before: first, limit: 80 });
		set((s) => {
			const c = s.byDot[dotId] ?? emptyChat();
			const byId = { ...c.byId };
			const add: string[] = [];
			for (const m of messages) {
				if (!byId[m.id]) add.push(m.id);
				byId[m.id] = m;
			}
			return { byDot: { ...s.byDot, [dotId]: { ...c, byId, order: [...add, ...c.order], hasMore, loading: false } } };
		});
	},

	async send(dotId, text, mode = "auto") {
		const nonce = Math.random().toString(36).slice(2, 12);
		const localId = `local_${nonce}`;
		const sentAt = Date.now();
		set((s) => {
			const c = s.byDot[dotId] ?? emptyChat();
			const next = put(c, {
				id: localId,
				dotId,
				role: "user",
				text,
				toolCalls: [],
				createdAt: new Date().toISOString(),
				streaming: false,
				timing: { sentAt },
			});
			return {
				byDot: { ...s.byDot, [dotId]: { ...next, pendingNonces: { ...next.pendingNonces, [nonce]: localId } } },
			};
		});
		try {
			const res = await api.chat.send(dotId, text, { mode, clientNonce: nonce });
			if (res.queued) {
				set((s) => {
					const c = s.byDot[dotId];
					if (!c?.byId[localId]) return s;
					return { byDot: { ...s.byDot, [dotId]: updateMsg(c, localId, (m) => ({ ...m, queued: res.queued })) } };
				});
			}
		} catch (e) {
			set((s) => {
				const c = s.byDot[dotId];
				if (!c) return s;
				return { byDot: { ...s.byDot, [dotId]: updateMsg(c, localId, (m) => ({ ...m, error: errorText(e) })) } };
			});
		}
	},

	async abort(dotId) {
		await api.chat.abort(dotId);
	},

	async clear(dotId) {
		await api.chat.clear(dotId);
		set((s) => ({ byDot: { ...s.byDot, [dotId]: emptyChat() } }));
		await get().loadHistory(dotId, true);
	},

	apply(e) {
		if (e.type === "status" || e.type === "dot-updated" || e.type === "error" || e.type === "events-received") return;
		const dotId = e.dotId;
		set((s) => {
			const c = s.byDot[dotId] ?? emptyChat();
			const next = reduceChat(c, e);
			return next === c ? s : { byDot: { ...s.byDot, [dotId]: next } };
		});
	},

	messages(dotId) {
		const c = get().byDot[dotId];
		if (!c) return [];
		return c.order.map((id) => c.byId[id]!).filter((m) => m && !m.hidden);
	},
}));
