import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defaultSettings } from "../../shared/defaults";
import type { AppSettings, Connection, Dot } from "../../shared/types";
import { JsonFile } from "../store/json-file";
import { briefingCandidates, briefingPrompt } from "./prompt";
import { BriefingService, type BriefingState } from "./service";

const dot = (id: string, name: string, extra: Partial<Dot> = {}): Dot =>
	({ id, name, kind: "standard", archived: false, grants: [], ...extra }) as unknown as Dot;
const google = {
	id: "con_g",
	type: "google",
	enabled: true,
	configured: true,
	features: ["calendar"],
} as unknown as Connection;

function setup(over: { settings?: Partial<AppSettings>; dots?: Dot[]; conns?: Connection[]; budget?: string } = {}) {
	const state = new JsonFile<BriefingState>({
		path: join(mkdtempSync(join(tmpdir(), "od-brief-")), "briefing.json"),
		schema: z.object({ lastRunDate: z.string().optional() }),
		defaults: () => ({}),
		version: 1,
	});
	let now = new Date(2025, 9, 7, 8, 0, 0);
	const start = vi.fn(async () => undefined);
	const note = vi.fn(async () => undefined);
	const settings = {
		...defaultSettings(),
		briefing: { enabled: true, time: "08:00", days: "weekdays" as const, dots: {}, instructions: "" },
		...over.settings,
	};
	const svc = new BriefingService({
		settings: async () => settings,
		state,
		listDots: async () =>
			over.dots ?? [dot("dot_a", "Calendar", { grants: [{ connectionId: "con_g", toolRules: {} }] })],
		connections: async () => over.conns ?? [google],
		superDot: async () => dot("dot_s", "SuperDot", { kind: "super" }),
		budgetBlock: async () => over.budget,
		start,
		note,
		now: () => now,
	});
	return { svc, state, start, note, setNow: (d: Date) => (now = d) };
}

describe("BriefingService", () => {
	it("runs once on time and never twice the same day", async () => {
		const t = setup();
		await t.svc.tick();
		expect(t.start).toHaveBeenCalledTimes(1);
		expect((await t.state.read()).lastRunDate).toBe("2025-10-07");
		t.setNow(new Date(2025, 9, 7, 8, 1));
		await t.svc.tick();
		t.setNow(new Date(2025, 9, 7, 12, 0));
		await t.svc.tick();
		expect(t.start).toHaveBeenCalledTimes(1);
	});

	it("catches up a missed run once, the same morning", async () => {
		const t = setup();
		t.setNow(new Date(2025, 9, 7, 10, 30));
		await t.svc.tick();
		await t.svc.tick();
		expect(t.start).toHaveBeenCalledTimes(1);
	});

	it("does not run when disabled or before the time", async () => {
		const off = setup({
			settings: { briefing: { enabled: false, time: "08:00", days: "weekdays", dots: {}, instructions: "" } },
		});
		await off.svc.tick();
		expect(off.start).not.toHaveBeenCalled();
		const early = setup();
		early.setNow(new Date(2025, 9, 7, 7, 0));
		await early.svc.tick();
		expect(early.start).not.toHaveBeenCalled();
	});

	it("a manual run always runs and counts as today's briefing", async () => {
		const t = setup();
		t.setNow(new Date(2025, 9, 7, 7, 0));
		expect((await t.svc.run({ manual: true })).started).toBe(true);
		expect((await t.svc.run({ manual: true })).started).toBe(true);
		t.setNow(new Date(2025, 9, 7, 8, 0));
		await t.svc.tick();
		expect(t.start).toHaveBeenCalledTimes(2);
	});

	it("skips quietly when the budget is used up", async () => {
		const t = setup({ budget: "today's budget is used up" });
		const r = await t.svc.run({ manual: true });
		expect(r.started).toBe(false);
		expect(t.start).not.toHaveBeenCalled();
		expect(t.note).toHaveBeenCalledOnce();
		expect(JSON.stringify(t.note.mock.calls[0])).toContain("budget");
	});

	it("says so when there are no Dots with connections", async () => {
		const t = setup({ dots: [dot("dot_a", "Writer")] });
		const r = await t.svc.run({ manual: true });
		expect(r.started).toBe(false);
		expect(t.start).not.toHaveBeenCalled();
		expect(JSON.stringify(t.note.mock.calls[0])).toContain("Google or Microsoft");
	});

	it("reports the next run", async () => {
		const t = setup();
		await t.svc.run({ manual: true });
		const st = await t.svc.status();
		expect(new Date(st.nextRunAt as string).getDate()).toBe(8);
		expect(st.candidates).toEqual([{ dotId: "dot_a", name: "Calendar", relevant: true, included: true }]);
	});
});

describe("briefing Dots and prompt", () => {
	it("includes Dots with relevant connections, honours overrides, skips hidden ones", () => {
		const dots = [
			dot("a", "Inbox", { grants: [{ connectionId: "con_g", toolRules: {} }] }),
			dot("b", "Writer"),
			dot("c", "Secret", { hiddenFromSuper: true, grants: [{ connectionId: "con_g", toolRules: {} }] }),
			dot("d", "Files", { grants: [{ connectionId: "con_m", toolRules: {} }] }),
		];
		const mac = { id: "con_m", type: "mac", enabled: true, features: ["files", "shell"] } as unknown as Connection;
		const c = briefingCandidates(dots, [google, mac], { b: true, a: false });
		expect(c.map((x) => [x.name, x.relevant, x.included])).toEqual([
			["Inbox", true, false],
			["Writer", false, true],
			["Files", false, false],
		]);
	});

	it("the prompt names the Dots, the question and the citation rule", () => {
		const p = briefingPrompt({
			dateText: "Tue 7 Oct",
			dotNames: ["Inbox", "Calendar"],
			instructions: "Keep it under 100 words",
		});
		expect(p).toContain("- Inbox");
		expect(p).toContain("NOTHING_IMPORTANT");
		expect(p).toContain("[Calendar]");
		expect(p).toContain("under 100 words");
		expect(p).not.toContain("—");
	});
});
