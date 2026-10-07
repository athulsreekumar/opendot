import { describe, expect, it } from "vitest";
import { defaultBriefing, defaultSettings, resolveBriefing } from "../../shared/defaults";
import { SettingsSchema } from "../../shared/schemas";
import { entriesToViews } from "../runtime/views";

describe("briefing settings", () => {
	it("is off by default, 08:00 on weekdays, all Dots", () => {
		expect(defaultBriefing()).toEqual({ enabled: false, time: "08:00", days: "weekdays", dots: {}, instructions: "" });
		expect(resolveBriefing(defaultSettings()).enabled).toBe(false);
	});

	it("an old settings file without `briefing` still loads and resolves to defaults", () => {
		const old = defaultSettings() as unknown as Record<string, unknown>;
		old.briefing = undefined;
		const parsed = SettingsSchema.parse(old);
		expect(parsed.briefing).toBeUndefined();
		expect(resolveBriefing(parsed)).toEqual(defaultBriefing());
	});

	it("a partial briefing object is filled with defaults", () => {
		const parsed = SettingsSchema.parse({ ...defaultSettings(), briefing: { enabled: true } });
		expect(parsed.briefing).toEqual({ ...defaultBriefing(), enabled: true });
	});

	it("rejects a bad time", () => {
		expect(() => SettingsSchema.parse({ ...defaultSettings(), briefing: { time: "8am" } })).toThrow();
	});
});

describe("briefing messages in history", () => {
	it("marks the reply to the hidden prompt as a briefing, and not later chat", () => {
		const t = "2025-10-07T08:00:00.000Z";
		const views = entriesToViews(
			"dot_s" as never,
			[
				{
					type: "custom_message",
					id: "c1",
					timestamp: t,
					customType: "opendot.briefing",
					content: "prompt",
					details: { date: "2025-10-07", label: "Briefing · Tue 7 Oct" },
				},
				{
					type: "message",
					id: "m1",
					timestamp: t,
					message: { role: "assistant", content: [{ type: "text", text: "Today [Calendar]" }] },
				},
				{ type: "message", id: "m2", timestamp: t, message: { role: "user", content: "thanks" } },
				{
					type: "message",
					id: "m3",
					timestamp: t,
					message: { role: "assistant", content: [{ type: "text", text: "Welcome" }] },
				},
				{
					type: "custom_message",
					id: "n1",
					timestamp: t,
					customType: "opendot.briefing-note",
					content: "Nothing yet",
					details: { date: "2025-10-08", label: "Briefing · Wed 8 Oct" },
				},
			],
			(s) => s,
			new Map(),
		);
		expect(views.map((v) => [v.id, v.briefing?.label])).toEqual([
			["m1", "Briefing · Tue 7 Oct"],
			["m2", undefined],
			["m3", undefined],
			["n1", "Briefing · Wed 8 Oct"],
		]);
	});
});
