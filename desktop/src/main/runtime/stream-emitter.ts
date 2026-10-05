// Token-level streaming to the renderer (spec 14 §2): first delta immediately, then ≤1 emit per frame,
// snapshots every second, PII-token-safe and tag-safe holdback.
import type { ChatEvent, ChatMessageView, DotId, MessageId } from "../../shared/types";

const OPEN = "⟦";
const CLOSE = "⟧";
const MAX_TOKEN_HOLD = 40;
const TAG_HOLD_CHARS = 12;

export type Importance = "urgent" | "update" | "quiet";

export interface StreamEmitterOptions {
	dotId: DotId;
	emit: (e: ChatEvent) => void;
	restore: (s: string) => string;
	now?: () => number;
	frameMs?: number;
	snapshotMs?: number;
}

/** Longest prefix of `raw` without an unclosed ⟦ (unless that open token is too long to be one). */
export function safePrefixLength(raw: string): number {
	const open = raw.lastIndexOf(OPEN);
	if (open === -1) return raw.length;
	const close = raw.indexOf(CLOSE, open);
	if (close !== -1) return raw.length;
	if (raw.length - open > MAX_TOKEN_HOLD) return raw.length;
	return open;
}

/** Parse the importance tag at the start of an event reply. undefined = need more text. */
export function parseTag(text: string, final: boolean): { importance: Importance; strip: number } | undefined {
	const t = text.trimStart();
	const lead = text.length - t.length;
	if (t.startsWith("NO_UPDATE")) return { importance: "quiet", strip: text.length };
	const m = /^\[(URGENT|UPDATE)\]\s*/.exec(t);
	if (m) return { importance: m[1] === "URGENT" ? "urgent" : "update", strip: lead + m[0].length };
	if (
		!final &&
		t.length < TAG_HOLD_CHARS &&
		("NO_UPDATE".startsWith(t) || "[URGENT]".startsWith(t) || "[UPDATE]".startsWith(t))
	) {
		return undefined;
	}
	return { importance: "update", strip: 0 };
}

interface MsgState {
	id: MessageId;
	base: ChatMessageView;
	raw: string;
	shown: string;
	sent: number;
	thinkingRaw: string;
	thinkingSent: number;
	seq: number;
	started: boolean;
	tagMode: boolean;
	importance?: Importance;
	tagStrip: number;
	firstTokenAt?: number;
	frameTimer?: ReturnType<typeof setTimeout>;
	lastSnapshot: number;
	toolArgs: Map<string, { buf: string; seq: number }>;
}

export class StreamEmitter {
	private cur: MsgState | undefined;
	private readonly frameMs: number;
	private readonly snapshotMs: number;
	private readonly now: () => number;

	constructor(private readonly o: StreamEmitterOptions) {
		this.frameMs = o.frameMs ?? 16;
		this.snapshotMs = o.snapshotMs ?? 1000;
		this.now = o.now ?? Date.now;
	}

	get messageId(): MessageId | undefined {
		return this.cur?.id;
	}

	/** Start an assistant message. With tagHoldback, message-start is deferred until the tag is known. */
	start(base: ChatMessageView, opts: { tagHoldback?: boolean } = {}): void {
		this.abort();
		this.cur = {
			id: base.id,
			base,
			raw: "",
			shown: "",
			sent: 0,
			thinkingRaw: "",
			thinkingSent: 0,
			seq: 0,
			started: false,
			tagMode: !!opts.tagHoldback,
			tagStrip: 0,
			lastSnapshot: this.now(),
			toolArgs: new Map(),
		};
		if (!this.cur.tagMode) this.emitStart();
	}

	text(delta: string): void {
		const c = this.cur;
		if (!c) return;
		if (c.firstTokenAt === undefined) c.firstTokenAt = this.now();
		c.raw += delta;
		if (c.tagMode && c.importance === undefined) {
			const tag = parseTag(c.raw, false);
			if (!tag) return;
			c.importance = tag.importance;
			c.tagStrip = tag.strip;
			if (tag.importance === "quiet") return; // suppress entirely
			this.emitStart();
		}
		if (c.importance === "quiet") return;
		this.recompute();
		this.schedule();
	}

	thinking(delta: string): void {
		const c = this.cur;
		if (!c) return;
		if (c.firstTokenAt === undefined) c.firstTokenAt = this.now();
		c.thinkingRaw += delta;
		if (c.tagMode && !c.started) return;
		this.schedule();
	}

	toolArgs(toolCallId: string, delta: string): void {
		const c = this.cur;
		if (!c?.started) return;
		const t = c.toolArgs.get(toolCallId) ?? { buf: "", seq: 0 };
		t.buf += delta;
		t.seq++;
		c.toolArgs.set(toolCallId, t);
		this.o.emit({ type: "tool-args-delta", dotId: this.o.dotId, messageId: c.id, toolCallId, seq: t.seq, delta });
	}

	/** Finish: flush, final snapshot. Returns the restored final text and importance (for tag messages). */
	end(final: { text: string; thinking?: string }): {
		text: string;
		importance?: Importance;
		hidden: boolean;
		firstTokenAt?: number;
	} {
		const c = this.cur;
		if (!c) return { text: final.text, hidden: false };
		if (c.frameTimer) clearTimeout(c.frameTimer);
		c.raw = final.text;
		if (final.thinking !== undefined) c.thinkingRaw = final.thinking;
		if (c.tagMode) {
			const tag = parseTag(c.raw, true)!;
			c.importance = tag.importance;
			c.tagStrip = tag.strip;
		}
		const hidden = c.importance === "quiet";
		const text = hidden ? "" : this.o.restore(c.raw.slice(c.tagStrip));
		if (!hidden) {
			if (!c.started) this.emitStart();
			c.seq++;
			this.o.emit({
				type: "message-update",
				dotId: this.o.dotId,
				messageId: c.id,
				seq: c.seq,
				text,
				thinking: c.thinkingRaw ? this.o.restore(c.thinkingRaw) : undefined,
			});
		}
		const out = { text, importance: c.importance, hidden, firstTokenAt: c.firstTokenAt };
		this.cur = undefined;
		return out;
	}

	abort(): void {
		if (this.cur?.frameTimer) clearTimeout(this.cur.frameTimer);
		this.cur = undefined;
	}

	private emitStart(): void {
		const c = this.cur!;
		c.started = true;
		this.o.emit({
			type: "message-start",
			dotId: this.o.dotId,
			message: {
				...c.base,
				text: "",
				streaming: true,
				importance: c.importance,
				timing: { ...(c.base.timing ?? {}), firstTokenAt: c.firstTokenAt },
			},
		});
	}

	private recompute(): void {
		const c = this.cur!;
		const body = c.raw.slice(c.tagStrip);
		const safe = body.slice(0, safePrefixLength(body));
		const restored = this.o.restore(safe);
		if (restored.startsWith(c.shown)) c.shown = restored;
		else {
			// Restoration changed earlier text (shouldn't happen); force a snapshot.
			c.shown = restored;
			c.sent = -1;
		}
	}

	private schedule(): void {
		const c = this.cur!;
		if (!c.started) return;
		const first = c.sent === 0 && c.shown.length > 0 && c.seq === 0;
		if (first) {
			this.flush();
			return;
		}
		if (!c.frameTimer) {
			c.frameTimer = setTimeout(() => {
				if (this.cur === c) {
					c.frameTimer = undefined;
					this.flush();
				}
			}, this.frameMs);
		}
	}

	private flush(): void {
		const c = this.cur;
		if (!c?.started) return;
		const now = this.now();
		const thinkingRestored = c.thinkingRaw ? this.o.restore(c.thinkingRaw) : "";
		if (c.sent < 0 || now - c.lastSnapshot >= this.snapshotMs) {
			c.seq++;
			c.lastSnapshot = now;
			c.sent = c.shown.length;
			c.thinkingSent = thinkingRestored.length;
			this.o.emit({
				type: "message-update",
				dotId: this.o.dotId,
				messageId: c.id,
				seq: c.seq,
				text: c.shown,
				thinking: thinkingRestored || undefined,
			});
			return;
		}
		const text = c.shown.slice(c.sent);
		const thinking = thinkingRestored.slice(c.thinkingSent);
		if (!text && !thinking) return;
		c.seq++;
		c.sent = c.shown.length;
		c.thinkingSent = thinkingRestored.length;
		this.o.emit({
			type: "message-delta",
			dotId: this.o.dotId,
			messageId: c.id,
			seq: c.seq,
			text: text || undefined,
			thinking: thinking || undefined,
		});
	}
}
