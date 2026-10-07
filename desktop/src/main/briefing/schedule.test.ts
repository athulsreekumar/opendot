import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { briefingLabel, dateKey, decide, nextRun, parseTime, scheduledAt } from "./schedule";

const cfg = { enabled: true, time: "08:00", days: "weekdays" as const };
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

describe("briefing schedule", () => {
	const tz = process.env.TZ;
	beforeAll(() => {
		process.env.TZ = "America/New_York";
	});
	afterAll(() => {
		if (tz === undefined) delete process.env.TZ;
		else process.env.TZ = tz;
	});

	it("parses times and falls back to 08:00", () => {
		expect(parseTime("07:05")).toEqual({ h: 7, m: 5 });
		expect(parseTime("25:00")).toEqual({ h: 8, m: 0 });
		expect(parseTime("nope")).toEqual({ h: 8, m: 0 });
	});

	it("waits for today's time, then tomorrow's", () => {
		// Tue 7 Oct 2025
		expect(nextRun(at(2025, 10, 7, 7, 0), cfg, undefined)).toEqual(at(2025, 10, 7, 8, 0));
		expect(nextRun(at(2025, 10, 7, 8, 0), cfg, undefined)).toEqual(at(2025, 10, 8, 8, 0));
		expect(nextRun(at(2025, 10, 7, 9, 0), cfg, "2025-10-07")).toEqual(at(2025, 10, 8, 8, 0));
	});

	it("skips weekends when weekdays only", () => {
		// Fri 10 Oct 2025 after the run -> Mon 13 Oct
		expect(nextRun(at(2025, 10, 10, 9, 0), cfg, "2025-10-10")).toEqual(at(2025, 10, 13, 8, 0));
		// Sat -> Mon
		expect(nextRun(at(2025, 10, 11, 6, 0), cfg, undefined)).toEqual(at(2025, 10, 13, 8, 0));
		// every day: Sat 8:00 is next
		expect(nextRun(at(2025, 10, 11, 6, 0), { ...cfg, days: "daily" }, undefined)).toEqual(at(2025, 10, 11, 8, 0));
	});

	it("is idle when disabled", () => {
		expect(decide(at(2025, 10, 7, 8, 0), { ...cfg, enabled: false }, undefined)).toEqual({ kind: "idle" });
		expect(nextRun(at(2025, 10, 7, 8, 0), { ...cfg, enabled: false }, undefined)).toBeUndefined();
	});

	it("runs on time", () => {
		const d = decide(at(2025, 10, 7, 8, 0), cfg, undefined);
		expect(d).toMatchObject({ kind: "run", catchUp: false });
		expect(decide(at(2025, 10, 7, 7, 59), cfg, undefined)).toMatchObject({ kind: "wait", at: at(2025, 10, 7, 8, 0) });
	});

	it("catches up a missed run the same day before 18:00, once", () => {
		expect(decide(at(2025, 10, 7, 11, 30), cfg, "2025-10-06")).toMatchObject({ kind: "run", catchUp: true });
		expect(decide(at(2025, 10, 7, 17, 59), cfg, undefined)).toMatchObject({ kind: "run", catchUp: true });
		expect(decide(at(2025, 10, 7, 18, 0), cfg, undefined)).toMatchObject({ kind: "wait", at: at(2025, 10, 8, 8, 0) });
	});

	it("never runs twice on the same day", () => {
		for (const h of [8, 9, 12, 17]) {
			const d = decide(at(2025, 10, 7, h, 0), cfg, "2025-10-07");
			expect(d.kind).toBe("wait");
		}
	});

	it("does not catch up on a day that is not a run day", () => {
		expect(decide(at(2025, 10, 11, 10, 0), cfg, undefined)).toMatchObject({ kind: "wait", at: at(2025, 10, 13, 8, 0) });
	});

	it("runs a briefing set after 18:00 when on time, but does not catch it up late", () => {
		const evening = { ...cfg, time: "20:00" };
		expect(decide(at(2025, 10, 7, 20, 5), evening, undefined)).toMatchObject({ kind: "run", catchUp: false });
		expect(decide(at(2025, 10, 7, 21, 30), evening, undefined).kind).toBe("wait");
	});

	it("keeps local wall-clock time across DST changes", () => {
		// US spring forward: Sun 9 Mar 2025. Fri 7 Mar -> Mon 10 Mar at 08:00 local, not 07:00 or 09:00.
		const n = nextRun(at(2025, 3, 7, 9, 0), cfg, "2025-03-07")!;
		expect(n.getDate()).toBe(10);
		expect(n.getHours()).toBe(8);
		// US fall back: Sun 2 Nov 2025. Fri 31 Oct -> Mon 3 Nov at 08:00.
		const m = nextRun(at(2025, 10, 31, 9, 0), cfg, "2025-10-31")!;
		expect(m.getDate()).toBe(3);
		expect(m.getHours()).toBe(8);
		// daily across the change: Sat 8 Mar after the run -> Sun 9 Mar 08:00 (EDT).
		const d = nextRun(at(2025, 3, 8, 9, 0), { ...cfg, days: "daily" }, "2025-03-08")!;
		expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([2, 9, 8]);
	});

	it("a time inside the spring-forward gap still lands on the same day", () => {
		const d = scheduledAt(at(2025, 3, 9, 12, 0), "02:30");
		expect(d.getDate()).toBe(9);
		expect(d.getHours()).toBe(3);
	});

	it("formats the card label and the date key", () => {
		expect(briefingLabel(at(2025, 10, 7))).toBe("Briefing · Tue 7 Oct");
		expect(dateKey(at(2025, 1, 5))).toBe("2025-01-05");
	});
});
