import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent, ChatMessageView } from "../../shared/types";
import { parseTag, StreamEmitter, safePrefixLength } from "./stream-emitter";

const base: ChatMessageView = {
	id: "m1",
	dotId: "dot_aaaaaaaaaaaa",
	role: "assistant",
	text: "",
	toolCalls: [],
	createdAt: new Date(0).toISOString(),
	streaming: true,
};

describe("StreamEmitter", () => {
	let t = 0;
	beforeEach(() => {
		vi.useFakeTimers();
		t = 0;
	});
	afterEach(() => vi.useRealTimers());

	const make = (vault: Record<string, string> = {}) => {
		const events: ChatEvent[] = [];
		const restore = (s: string) => s.replace(/⟦[A-Z_]+_\d+⟧/g, (m) => vault[m] ?? m);
		const em = new StreamEmitter({ dotId: base.dotId, emit: (e) => events.push(e), restore, now: () => t });
		return { em, events };
	};
	const shownText = (events: ChatEvent[]) => {
		let s = "";
		for (const e of events) {
			if (e.type === "message-delta") s += e.text ?? "";
			if (e.type === "message-update") s = e.text;
		}
		return s;
	};

	it("emits the first delta immediately and coalesces the rest per frame", () => {
		const { em, events } = make();
		em.start(base);
		expect(events[0]?.type).toBe("message-start");
		em.text("Hel");
		expect(events.filter((e) => e.type === "message-delta")).toHaveLength(1);
		em.text("lo");
		em.text(" there");
		expect(events.filter((e) => e.type === "message-delta")).toHaveLength(1);
		vi.advanceTimersByTime(16);
		expect(events.filter((e) => e.type === "message-delta")).toHaveLength(2);
		expect(shownText(events)).toBe("Hello there");
	});

	it("holds back a PII token split across deltas and restores it", () => {
		const { em, events } = make({ "⟦EMAIL_1⟧": "a@b.co" });
		em.start(base);
		em.text("Hel");
		em.text("lo ⟦EMA");
		vi.advanceTimersByTime(16);
		expect(shownText(events)).toBe("Hello ");
		em.text("IL_1⟧ there");
		vi.advanceTimersByTime(16);
		expect(shownText(events)).toBe("Hello a@b.co there");
		const end = em.end({ text: "Hello ⟦EMAIL_1⟧ there" });
		expect(end.text).toBe("Hello a@b.co there");
		const seqs = events.filter((e) => "seq" in e).map((e) => (e as { seq: number }).seq);
		expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
	});

	it("suppresses NO_UPDATE replies entirely", () => {
		const { em, events } = make();
		em.start(base, { tagHoldback: true });
		em.text("NO_");
		em.text("UPDATE");
		vi.advanceTimersByTime(100);
		const r = em.end({ text: "NO_UPDATE" });
		expect(events).toHaveLength(0);
		expect(r.hidden).toBe(true);
	});

	it("strips [URGENT] and marks importance", () => {
		const { em, events } = make();
		em.start(base, { tagHoldback: true });
		em.text("[URG");
		expect(events).toHaveLength(0);
		em.text("ENT] Server down");
		const start = events.find((e) => e.type === "message-start");
		expect(start && start.type === "message-start" && start.message.importance).toBe("urgent");
		vi.advanceTimersByTime(16);
		expect(shownText(events)).toBe("Server down");
		expect(em.end({ text: "[URGENT] Server down" }).importance).toBe("urgent");
	});

	it("sends periodic snapshots", () => {
		const { em, events } = make();
		em.start(base);
		em.text("a");
		t = 1200;
		em.text("b");
		vi.advanceTimersByTime(16);
		expect(events.some((e) => e.type === "message-update")).toBe(true);
	});

	it("helpers", () => {
		expect(safePrefixLength("abc ⟦EM")).toBe(4);
		expect(safePrefixLength("abc ⟦EMAIL_1⟧")).toBe(13);
		expect(parseTag("[UPD", false)).toBeUndefined();
		expect(parseTag("Hello", false)?.importance).toBe("update");
	});
});
