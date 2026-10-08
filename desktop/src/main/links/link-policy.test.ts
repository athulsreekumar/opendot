import { describe, expect, it } from "vitest";
import { defaultAlwaysOn, defaultPersona, emptyProfile } from "../../shared/defaults";
import type { AppSettings, Dot, DotId, DotLink, LinkSchedule, LinkSubject } from "../../shared/types";
import { decideLink, effectivePairs, type LinkCounters, subjectMatches } from "./link-policy";
import { describeSchedule, isOpen } from "./schedule";

function dot(id: string, over: Partial<Dot> = {}): Dot {
	const name = over.name ?? id.toUpperCase();
	return {
		id: `dot_${id}`,
		kind: "standard",
		name,
		tagline: "",
		appearance: { color: "teal", icon: "mail" },
		persona: defaultPersona(name),
		suggestedConnections: [],
		thinkingLevel: "off",
		grants: [],
		roles: [],
		piiMode: "off",
		alwaysOn: defaultAlwaysOn(),
		profile: emptyProfile(),
		hiddenFromSuper: false,
		workspaceDir: "/tmp",
		pinned: false,
		muted: false,
		archived: false,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		lastActivityAt: "2026-01-01T00:00:00.000Z",
		lastMessagePreview: "",
		unreadCount: 0,
		...over,
	} as unknown as Dot;
}

let n = 0;
function rule(from: LinkSubject, to: LinkSubject, over: Partial<DotLink> = {}): DotLink {
	n++;
	return {
		id: `lnk_${n}`,
		from,
		to,
		effect: "allow",
		enabled: true,
		approval: "auto",
		maxPerHour: 10,
		sharePii: false,
		purpose: "",
		createdAt: new Date(2026, 0, n).toISOString(),
		...over,
	};
}

const d = (id: string): LinkSubject => ({ kind: "dot", dotId: `dot_${id}` });
const role = (r: string): LinkSubject => ({ kind: "role", role: r });
const any: LinkSubject = { kind: "any" };
const superS: LinkSubject = { kind: "super" };

const settings: AppSettings["links"] = { globalDailyBudget: 200, maxDepth: 3, replyTimeoutSec: 120 };
const zero: LinkCounters = { pairLastHour: () => 0, globalToday: () => 0 };
const now = new Date("2026-03-04T10:00:00Z");

function run(
	from: Dot,
	to: Dot,
	rules: DotLink[],
	extra: { now?: Date; counters?: LinkCounters; chain?: DotId[]; settings?: AppSettings["links"] } = {},
) {
	return decideLink({
		from,
		to,
		rules,
		now: extra.now ?? now,
		counters: extra.counters ?? zero,
		chain: extra.chain ?? [],
		settings: extra.settings ?? settings,
	});
}

const A = dot("a");
const B = dot("b");

describe("decideLink table", () => {
	it("1 no rules", () => {
		const r = run(A, B, []);
		expect(r.allowed).toBe(false);
		expect(r.reason).toBe("No rule allows A to message B");
	});
	it("2 allow auto", () => {
		const r = run(A, B, [rule(d("a"), d("b"), { sharePii: true, purpose: "p" })]);
		expect(r).toMatchObject({ allowed: true, approval: "auto", sharePii: true, purpose: "p" });
	});
	it("3 allow ask", () => {
		expect(run(A, B, [rule(d("a"), d("b"), { approval: "ask" })])).toMatchObject({ allowed: true, approval: "ask" });
	});
	it("4 role to any", () => {
		expect(run(dot("a", { roles: ["assistant"] }), B, [rule(role("assistant"), any)]).allowed).toBe(true);
	});
	const Fd = dot("f");
	const As = dot("a", { roles: ["assistant"] });
	it("5 specific deny beats broad allow", () => {
		const r = run(As, Fd, [rule(role("assistant"), any), rule(role("assistant"), d("f"), { effect: "deny" })]);
		expect(r.allowed).toBe(false);
	});
	it("6 dot-to-dot allow beats role deny", () => {
		const r = run(As, Fd, [
			rule(role("assistant"), any),
			rule(role("assistant"), d("f"), { effect: "deny" }),
			rule(d("a"), d("f")),
		]);
		expect(r.allowed).toBe(true);
	});
	it("7 deny wins at equal score", () => {
		expect(run(A, B, [rule(any, any), rule(any, any, { effect: "deny" })]).allowed).toBe(false);
	});
	const sched: LinkSchedule = { timeZone: "UTC", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" };
	it("8 schedule open", () => {
		expect(
			run(A, B, [rule(d("a"), d("b"), { schedule: sched })], { now: new Date("2026-03-04T10:00:00Z") }).allowed,
		).toBe(true);
	});
	it("9 schedule closed", () => {
		const r = run(A, B, [rule(d("a"), d("b"), { schedule: sched })], { now: new Date("2026-03-07T10:00:00Z") });
		expect(r.allowed).toBe(false);
		expect(r.reason).toContain("Outside allowed hours");
		expect(r.reason).toContain("Mon–Fri 09:00–18:00 (UTC)");
	});
	const night = (days: number[]): LinkSchedule => ({ timeZone: "Asia/Kolkata", days, start: "22:00", end: "06:00" });
	// Tue 2026-03-03 01:00 IST = Mon 19:30Z
	const tue1 = new Date("2026-03-02T19:30:00Z");
	it("10 spill-over from Monday", () => {
		expect(run(A, B, [rule(d("a"), d("b"), { schedule: night([0, 1, 2, 3, 4, 5, 6]) })], { now: tue1 }).allowed).toBe(
			true,
		);
	});
	it("11 spill-over needs Monday", () => {
		expect(run(A, B, [rule(d("a"), d("b"), { schedule: night([2]) })], { now: tue1 }).allowed).toBe(false);
	});
	it("12 rate limit", () => {
		const counters: LinkCounters = { pairLastHour: () => 2, globalToday: () => 0 };
		const r = run(A, B, [rule(d("a"), d("b"), { maxPerHour: 2 })], { counters });
		expect(r.allowed).toBe(false);
		expect(r.reason).toBe("Rate limit reached (2/hour)");
	});
	it("13 chain depth 2 allowed", () => {
		expect(run(A, B, [rule(d("a"), d("b"))], { chain: ["dot_c", "dot_a"] }).allowed).toBe(true);
	});
	it("14 loop", () => {
		const r = run(B, A, [rule(any, any)], { chain: ["dot_a", "dot_b"] });
		expect(r.allowed).toBe(false);
		expect(r.reason).toBe("Loop detected: A → B → A");
	});
	it("15 too many hops", () => {
		const r = run(dot("c"), dot("d"), [rule(any, any)], { chain: ["dot_a", "dot_b", "dot_c"] });
		expect(r.reason).toBe("Too many hops");
	});
	it("16 disabled rule", () => {
		const r = run(A, B, [rule(d("a"), d("b"), { enabled: false })]);
		expect(r.reason).toContain("No rule allows");
	});
	it("17 global budget", () => {
		const counters: LinkCounters = { pairLastHour: () => 0, globalToday: () => 200 };
		const r = run(A, B, [rule(d("a"), d("b"))], { counters });
		expect(r.allowed).toBe(false);
		expect(r.reason).toBe("Daily Dot-to-Dot budget used up");
	});
	it("18 archived target", () => {
		const r = run(A, dot("b", { archived: true }), [rule(d("a"), d("b"))]);
		expect(r.reason).toBe("Target is archived");
	});
	it("self message", () => {
		expect(run(A, A, [rule(any, any)]).reason).toBe("A Dot can't message itself");
	});
});

describe("SuperBot cases", () => {
	const S = dot("s", { kind: "super", name: "SuperDot" });
	const seeded = rule(superS, any, { maxPerHour: 60, sharePii: true });
	it("19 seeded super rule", () => {
		expect(run(S, dot("inbox", { name: "Inbox" }), [seeded])).toMatchObject({ allowed: true, approval: "auto" });
	});
	it("20 deny super to finance role", () => {
		const ledger = dot("ledger", { name: "Ledger", roles: ["finance"] });
		const r = run(S, ledger, [seeded, rule(superS, role("finance"), { effect: "deny" })]);
		expect(r.allowed).toBe(false);
	});
	it("21 hiddenFromSuper", () => {
		const r = run(S, dot("h", { hiddenFromSuper: true }), [seeded]);
		expect(r).toMatchObject({ allowed: false, reason: "Hidden from SuperDot" });
	});
	it("22 Dot asks Super", () => {
		expect(run(A, S, [rule(any, any)]).allowed).toBe(true);
		expect(run(A, S, [rule(any, any)], { chain: ["dot_x", "dot_y", "dot_z"] }).reason).toBe("Too many hops");
	});
});

describe("helpers", () => {
	it("subjectMatches", () => {
		expect(subjectMatches(superS, dot("s", { kind: "super" }))).toBe(true);
		expect(subjectMatches(superS, A)).toBe(false);
		expect(subjectMatches(role("x"), dot("q", { roles: ["x"] }))).toBe(true);
	});
	it("effectivePairs", () => {
		const r = rule(d("a"), d("b"), { approval: "ask" });
		const pairs = effectivePairs([A, B], [r], now);
		expect(pairs).toEqual([{ from: "dot_a", to: "dot_b", approval: "ask", ruleId: r.id }]);
	});
});

describe("schedule", () => {
	it("crosses midnight same day and next morning", () => {
		const s: LinkSchedule = { timeZone: "UTC", days: [1], start: "22:00", end: "06:00" };
		expect(isOpen(s, new Date("2026-03-02T23:00:00Z"))).toBe(true);
		expect(isOpen(s, new Date("2026-03-03T05:59:00Z"))).toBe(true);
		expect(isOpen(s, new Date("2026-03-03T06:00:00Z"))).toBe(false);
		expect(isOpen(s, new Date("2026-03-03T23:00:00Z"))).toBe(false);
	});
	it("Asia/Kolkata offset", () => {
		const s: LinkSchedule = { timeZone: "Asia/Kolkata", days: [3], start: "09:00", end: "10:00" };
		expect(isOpen(s, new Date("2026-03-04T03:45:00Z"))).toBe(true); // 09:15 IST Wed
		expect(isOpen(s, new Date("2026-03-04T04:30:00Z"))).toBe(false);
	});
	it("Europe/London DST", () => {
		const s: LinkSchedule = { timeZone: "Europe/London", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" };
		expect(isOpen(s, new Date("2026-01-14T09:00:00Z"))).toBe(true); // GMT
		expect(isOpen(s, new Date("2026-07-15T08:30:00Z"))).toBe(true); // 09:30 BST
		expect(isOpen(s, new Date("2026-07-15T07:30:00Z"))).toBe(false); // 08:30 BST closed
	});
	it("days filter", () => {
		const s: LinkSchedule = { timeZone: "UTC", days: [6], start: "00:00", end: "23:59" };
		expect(isOpen(s, new Date("2026-03-07T12:00:00Z"))).toBe(true);
		expect(isOpen(s, new Date("2026-03-08T12:00:00Z"))).toBe(false);
	});
	it("start === end is all day", () => {
		const s: LinkSchedule = { timeZone: "UTC", days: [0], start: "00:00", end: "00:00" };
		expect(isOpen(s, new Date("2026-03-08T00:00:00Z"))).toBe(true);
		expect(isOpen(s, new Date("2026-03-08T23:59:00Z"))).toBe(true);
		expect(isOpen(s, new Date("2026-03-09T00:00:00Z"))).toBe(false);
	});
	it("describeSchedule", () => {
		expect(describeSchedule({ timeZone: "Europe/London", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" })).toBe(
			"Mon–Fri 09:00–18:00 (Europe/London)",
		);
		expect(describeSchedule({ timeZone: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "00:00" })).toBe(
			"Every day 00:00–00:00 (UTC)",
		);
		expect(describeSchedule({ timeZone: "UTC", days: [1, 3, 4, 5], start: "08:00", end: "09:00" })).toBe(
			"Mon, Wed–Fri 08:00–09:00 (UTC)",
		);
	});
});
