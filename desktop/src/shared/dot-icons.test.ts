import { describe, expect, it } from "vitest";
import {
	DEFAULT_DOT_ICON,
	DOT_ICON_KEYS,
	DOT_ICONS,
	iconFromEmoji,
	iconFromText,
	isDotIconKey,
	migrateDotAppearance,
	normalizeIconKey,
	resolveDotIcon,
	searchDotIcons,
} from "./dot-icons";

describe("the curated icon set", () => {
	it("has 60 to 90 icons with unique keys, labels and keywords", () => {
		expect(DOT_ICONS.length).toBeGreaterThanOrEqual(60);
		expect(DOT_ICONS.length).toBeLessThanOrEqual(90);
		expect(new Set(DOT_ICON_KEYS).size).toBe(DOT_ICONS.length);
		expect(new Set(DOT_ICONS.map((i) => i.label)).size).toBe(DOT_ICONS.length);
		for (const i of DOT_ICONS) {
			expect(i.key).toMatch(/^[a-z][a-z-]*$/);
			expect(i.keywords.length).toBeGreaterThanOrEqual(3);
			for (const k of i.keywords) expect(k).toBe(k.toLowerCase());
		}
	});

	it("includes the icons the product relies on", () => {
		for (const k of [
			"mail",
			"calendar",
			"search",
			"wallet",
			"plane",
			"code",
			"shield",
			"users",
			"megaphone",
			"briefcase",
			"headphones",
			"scale",
			"chart",
			"file",
			"folder",
			"home",
			"heart",
			"book",
			"brain",
			"bell",
			"globe",
			"shopping-cart",
			"truck",
			"camera",
			"music",
			"sparkles",
			"wrench",
			"compass",
			"palette",
			"monitor",
			"sprout",
			"folder-kanban",
		]) {
			expect(isDotIconKey(k), k).toBe(true);
		}
		expect(isDotIconKey(DEFAULT_DOT_ICON)).toBe(true);
	});
});

describe("emoji migration table", () => {
	it.each([
		["📬", "mail"],
		["📅", "calendar"],
		["🗓", "calendar"],
		["🗓️", "calendar"],
		["✈️", "plane"],
		["💸", "wallet"],
		["💰", "wallet"],
		["🔎", "search"],
		["🔭", "telescope"],
		["🛠️", "wrench"],
		["🛠", "wrench"],
		["🛡️", "shield"],
		["🎧", "headphones"],
		["⚖️", "scale"],
		["📣", "megaphone"],
		["💼", "briefcase"],
		["🧭", "compass"],
		["🎨", "palette"],
		["🌱", "sprout"],
		["🗂️", "folder"],
		["💬", "message"],
		["✦", "sparkles"],
		["✍️", "pen"],
		["🧾", "receipt"],
		["🙂", "user"],
	])("%s -> %s", (emoji, key) => {
		expect(iconFromEmoji(emoji)).toBe(key);
	});

	it("only maps to keys that exist", () => {
		for (const e of "📬📅✈💸🔎🛠🛡🎧⚖📣💼🧭🎨🌱🗂💬✦✍🧾🙂🦊🌙🚀🧠📚🏠❤🎵📷🛒🚚🔔🌐") {
			const k = iconFromEmoji(e);
			if (k) expect(isDotIconKey(k), e).toBe(true);
		}
	});

	it("returns undefined for unknown emoji, text and empty input", () => {
		expect(iconFromEmoji("🫠")).toBeUndefined();
		expect(iconFromEmoji("")).toBeUndefined();
		expect(iconFromEmoji(undefined)).toBeUndefined();
	});
});

describe("keyword fallback", () => {
	it("picks an icon from the name and tagline", () => {
		expect(iconFromText("Inbox Zero", "Sorts my email")).toBe("mail");
		expect(iconFromText("Trip Planner", "Books flights and hotels")).toBe("plane");
		expect(iconFromText("Budget", "Tracks my spending")).toBe("wallet");
		expect(iconFromText("Forge", "Helps me code and debug")).toBe("code");
		expect(iconFromText("Helpdesk", "customer support tickets")).toBe("headphones");
	});

	it("returns undefined when nothing matches", () => {
		expect(iconFromText("Zorp", "Blarg")).toBeUndefined();
		expect(iconFromText("", undefined)).toBeUndefined();
	});
});

describe("normalizeIconKey", () => {
	it("accepts keys, loose spellings, emoji and keywords, rejects junk", () => {
		expect(normalizeIconKey("mail")).toBe("mail");
		expect(normalizeIconKey("  Folder Kanban ")).toBe("folder-kanban");
		expect(normalizeIconKey("shopping_cart")).toBe("shopping-cart");
		expect(normalizeIconKey("lucide:Wrench")).toBe("wrench");
		expect(normalizeIconKey("📬")).toBe("mail");
		expect(normalizeIconKey("email")).toBe("mail");
		expect(normalizeIconKey("definitely-not-an-icon")).toBeUndefined();
		expect(normalizeIconKey("")).toBeUndefined();
		expect(normalizeIconKey(42)).toBeUndefined();
	});
});

describe("resolveDotIcon", () => {
	it("prefers a valid icon, then the emoji, then keywords, then the default", () => {
		expect(resolveDotIcon({ icon: "plane", emoji: "📬", name: "Mailer" })).toBe("plane");
		expect(resolveDotIcon({ icon: "bogus", emoji: "📬", name: "Travel" })).toBe("mail");
		expect(resolveDotIcon({ emoji: "🫠", name: "Travel agent", tagline: "flights" })).toBe("plane");
		expect(resolveDotIcon({ emoji: "🫠", name: "Zorp" })).toBe(DEFAULT_DOT_ICON);
		expect(resolveDotIcon({})).toBe(DEFAULT_DOT_ICON);
	});
});

describe("searchDotIcons", () => {
	it("returns everything for an empty query", () => {
		expect(searchDotIcons("")).toHaveLength(DOT_ICONS.length);
		expect(searchDotIcons("   ")).toHaveLength(DOT_ICONS.length);
	});

	it("matches keywords, labels and keys", () => {
		expect(searchDotIcons("email").map((i) => i.key)).toContain("mail");
		expect(searchDotIcons("flight").map((i) => i.key)).toContain("plane");
		expect(searchDotIcons("Kanban").map((i) => i.key)).toContain("folder-kanban");
		expect(searchDotIcons("zzzzqq")).toEqual([]);
	});
});

describe("migrateDotAppearance", () => {
	const base = { id: "dot_x", kind: "standard", name: "Inbox", tagline: "Sorts mail", appearance: { color: "teal" } };

	it("converts a known emoji and drops the emoji field", () => {
		const out = migrateDotAppearance({ ...base, appearance: { emoji: "✈️", color: "teal" } });
		expect(out.appearance).toEqual({ icon: "plane", color: "teal" });
	});

	it("uses name and tagline keywords for an unknown emoji", () => {
		const out = migrateDotAppearance({ ...base, appearance: { emoji: "🫠", color: "blue" } });
		expect(out.appearance).toEqual({ icon: "mail", color: "blue" });
	});

	it("falls back to the neutral default when nothing matches", () => {
		const out = migrateDotAppearance({
			...base,
			name: "Zorp",
			tagline: "Blarg",
			appearance: { emoji: "🫠", color: "blue" },
		});
		expect(out.appearance).toEqual({ icon: DEFAULT_DOT_ICON, color: "blue" });
	});

	it("gives a SuperDot the sparkles icon", () => {
		const out = migrateDotAppearance({
			...base,
			kind: "super",
			name: "Zorp",
			appearance: { emoji: "🫠", color: "teal" },
		});
		expect((out.appearance as { icon?: string }).icon).toBe("sparkles");
	});

	it("leaves an already migrated dot untouched (same object)", () => {
		const done = { ...base, appearance: { icon: "mail", color: "teal" } };
		expect(migrateDotAppearance(done)).toBe(done);
	});

	it("drops a stale emoji next to a valid icon and replaces an invalid icon", () => {
		expect(
			migrateDotAppearance({ ...base, appearance: { icon: "mail", emoji: "📬", color: "teal" } }).appearance,
		).toEqual({
			icon: "mail",
			color: "teal",
		});
		expect(
			migrateDotAppearance({ ...base, appearance: { icon: "bogus", emoji: "💸", color: "teal" } }).appearance.icon,
		).toBe("wallet");
	});

	it("ignores things that are not dots", () => {
		expect(migrateDotAppearance(null)).toBeNull();
		expect(migrateDotAppearance("x")).toBe("x");
		const noAppearance = { name: "x" };
		expect(migrateDotAppearance(noAppearance)).toBe(noAppearance);
	});
});
