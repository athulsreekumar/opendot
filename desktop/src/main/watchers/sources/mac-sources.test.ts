import { describe, expect, it } from "vitest";
import type { Dot, Watcher } from "../../../shared/types";
import type { SourceCtx, SourceDeps } from "../types";
import { NeedsAuthError } from "../types";
import { SOURCES_MAC } from "./index-mac";
import { macCalendarSource } from "./mac-calendar";
import { macRemindersSource } from "./mac-reminders";

const NOW = new Date("2026-01-01T10:00:00Z");

function ctx<C>(config: C, runJxa: (s: string) => Promise<string>, now = NOW): SourceCtx<C> {
	const deps = { runJxa, now: () => now } as unknown as SourceDeps;
	return { watcher: {} as Watcher, config, dot: {} as Dot, deps, emit: () => {}, signal: new AbortController().signal };
}

describe("SOURCES_MAC", () => {
	it("registers both with poll intervals", () => {
		expect(SOURCES_MAC.map((s) => [s.type, s.defaultIntervalSec, s.minIntervalSec])).toEqual([
			["mac-calendar", 120, 60],
			["mac-reminders", 60, 60],
		]);
	});
});

describe("mac-calendar", () => {
	const ev = (id: string, startMin: number) => ({
		id,
		title: "Standup",
		start: new Date(NOW.getTime() + startMin * 60000).toISOString(),
		end: new Date(NOW.getTime() + (startMin + 30) * 60000).toISOString(),
		calendar: "Work",
	});

	it("first run is silent, then reminds once", async () => {
		const run = async () => JSON.stringify([ev("a", 10), ev("b", 120)]);
		const first = await macCalendarSource.poll?.(ctx({ remindMinutes: [15] }, run), undefined);
		expect(first?.events).toEqual([]);
		const second = await macCalendarSource.poll?.(ctx({ remindMinutes: [15] }, run), first?.cursor);
		expect(second?.events).toEqual([]);
	});

	it("emits for a newly due event and dedupes after", async () => {
		const early = async () => JSON.stringify([ev("a", 30)]);
		const first = await macCalendarSource.poll?.(ctx({ remindMinutes: [15] }, early), undefined);
		const later = new Date(NOW.getTime() + 20 * 60000);
		const run = async () => JSON.stringify([ev("a", 30)]);
		const r = await macCalendarSource.poll?.(ctx({ remindMinutes: [15] }, run, later), first?.cursor);
		expect(r?.events).toHaveLength(1);
		expect(r?.events[0]?.title).toContain("Standup");
		expect(r?.events[0]?.dedupeKey).toContain("mac-calendar:a:");
		const again = await macCalendarSource.poll?.(ctx({ remindMinutes: [15] }, run, later), r?.cursor);
		expect(again?.events).toEqual([]);
	});

	it("-1743 becomes NeedsAuthError; test() reports samples", async () => {
		const bad = async () => {
			throw new Error("Not authorized to send Apple events (-1743)");
		};
		await expect(macCalendarSource.poll?.(ctx({ remindMinutes: [15] }, bad), undefined)).rejects.toBeInstanceOf(
			NeedsAuthError,
		);
		const t = await macCalendarSource.test(ctx({ remindMinutes: [15] }, async () => JSON.stringify([ev("a", 5)])));
		expect(t.ok).toBe(true);
		expect(t.sample).toHaveLength(1);
	});
});

describe("mac-reminders", () => {
	const due = [{ id: "r1", title: "Pay rent", due: "2026-01-01T09:00:00.000Z", list: "Home" }];

	it("first run silent, new due reminder emits once, redue with new date emits again", async () => {
		const first = await macRemindersSource.poll?.(
			ctx({}, async () => "[]"),
			undefined,
		);
		expect(first?.events).toEqual([]);
		const run = async () => JSON.stringify(due);
		const r = await macRemindersSource.poll?.(ctx({}, run), first?.cursor);
		expect(r?.events).toHaveLength(1);
		expect(r?.events[0]?.title).toBe("Reminder due: Pay rent");
		const dup = await macRemindersSource.poll?.(ctx({}, run), r?.cursor);
		expect(dup?.events).toEqual([]);
		const moved = async () => JSON.stringify([{ ...due[0], due: "2026-01-01T09:30:00.000Z" }]);
		const again = await macRemindersSource.poll?.(ctx({}, moved), dup?.cursor);
		expect(again?.events).toHaveLength(1);
	});

	it("list name is embedded via JSON escaping", async () => {
		let script = "";
		await macRemindersSource.poll?.(
			ctx({ list: 'x"); evil(); ("' }, async (s) => {
				script = s;
				return "[]";
			}),
			undefined,
		);
		expect(script).toContain(JSON.stringify('x"); evil(); ("'));
	});
});
