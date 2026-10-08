import { describe, expect, it } from "vitest";
import { DOT_ICON_KEYS, isDotIconKey } from "../../shared/dot-icons";
import { fallbackDraft, parseDraftJson, systemPrompt, toDraft } from "./dot-architect";

const reply = (extra: Record<string, unknown>) =>
	JSON.stringify({
		name: "Trip Planner",
		tagline: "Plans flights and hotels",
		color: "sky",
		role: "You are Trip Planner. You plan trips and compare flights carefully.",
		...extra,
	});

const draftOf = (extra: Record<string, unknown>) => toDraft(parseDraftJson(reply(extra)), []);

describe("architect icon handling", () => {
	it("tells the model the whole curated list and asks for no emoji", () => {
		const p = systemPrompt([]);
		expect(p).toContain('"icon": one of [');
		for (const k of DOT_ICON_KEYS) expect(p).toContain(k);
		expect(p).not.toContain('"emoji"');
	});

	it("keeps a valid icon key", () => {
		expect(draftOf({ icon: "plane" }).appearance).toEqual({ icon: "plane", color: "sky" });
	});

	it("tidies a loosely written key", () => {
		expect(draftOf({ icon: "Shopping Cart" }).appearance.icon).toBe("shopping-cart");
	});

	it("falls back to keyword matching when the key is invented", () => {
		expect(draftOf({ icon: "airplane-takeoff" }).appearance.icon).toBe("plane");
	});

	it("maps an emoji from an older style reply through the migration table", () => {
		expect(draftOf({ emoji: "📬" }).appearance.icon).toBe("mail");
		expect(draftOf({ icon: "📅" }).appearance.icon).toBe("calendar");
	});

	it("never stores an emoji, and always yields a key in the set", () => {
		const d = draftOf({ emoji: "🫠", icon: "???" });
		expect(isDotIconKey(d.appearance.icon)).toBe(true);
		expect(Object.keys(d.appearance).sort()).toEqual(["color", "icon"]);
	});

	it("works when the reply has no icon at all", () => {
		expect(draftOf({}).appearance.icon).toBe("plane");
		expect(draftOf({ name: "Zorp", tagline: "Blarg" }).appearance.icon).toBe("message");
	});

	it("the offline fallback draft uses a valid icon", () => {
		const d = fallbackDraft("Answer my client emails", []);
		expect(d.appearance.icon).toBe("mail");
		expect(isDotIconKey(fallbackDraft("zzz qqq", []).appearance.icon)).toBe(true);
	});
});
