import { describe, expect, it } from "vitest";
import { defaultSettings } from "./defaults";
import {
	acceleratorLabel,
	acceleratorWords,
	activeMention,
	defaultQuickAsk,
	filterMentionTargets,
	insertMention,
	parseMention,
	QUICK_ASK_PRESETS,
	resolveQuickAsk,
} from "./quickask";
import { SettingsSchema } from "./schemas";

describe("quick ask settings", () => {
	it("defaults to on with Alt+Space", () => {
		expect(defaultQuickAsk()).toEqual({ enabled: true, shortcut: "Alt+Space" });
		expect(defaultSettings().quickAsk).toEqual(defaultQuickAsk());
	});

	it("fills in defaults for old settings files without quickAsk", () => {
		expect(resolveQuickAsk(undefined)).toEqual(defaultQuickAsk());
		expect(resolveQuickAsk({})).toEqual(defaultQuickAsk());
		const old = { ...defaultSettings() } as Partial<ReturnType<typeof defaultSettings>>;
		delete old.quickAsk;
		expect(SettingsSchema.parse(old).quickAsk).toBeUndefined();
		expect(resolveQuickAsk(old)).toEqual(defaultQuickAsk());
	});

	it("keeps a valid choice and falls back on anything else", () => {
		expect(resolveQuickAsk({ quickAsk: { enabled: false, shortcut: "Ctrl+Shift+Space" } })).toEqual({
			enabled: false,
			shortcut: "Ctrl+Shift+Space",
		});
		expect(resolveQuickAsk({ quickAsk: { shortcut: "Ctrl+Q" } }).shortcut).toBe("Alt+Space");
		expect(resolveQuickAsk({ quickAsk: { enabled: undefined } }).enabled).toBe(true);
	});

	it("validates in the settings schema", () => {
		const s = { ...defaultSettings(), quickAsk: { enabled: false, shortcut: "Alt+Space" } };
		expect(SettingsSchema.parse(s).quickAsk).toEqual({ enabled: false, shortcut: "Alt+Space" });
		expect(() => SettingsSchema.parse({ ...s, quickAsk: { enabled: "no", shortcut: "x" } })).toThrow();
	});
});

describe("accelerator labels", () => {
	it("uses Mac glyphs on macOS", () => {
		expect(acceleratorLabel("Alt+Space", "darwin")).toBe("⌥Space");
		expect(acceleratorLabel("Ctrl+Shift+Space", "darwin")).toBe("⌃⇧Space");
		expect(acceleratorLabel("CommandOrControl+Shift+O", "darwin")).toBe("⌘⇧O");
	});
	it("spells modifiers out elsewhere", () => {
		expect(acceleratorLabel("Alt+Space", "win32")).toBe("Alt+Space");
		expect(acceleratorLabel("CommandOrControl+Shift+O", "win32")).toBe("Ctrl+Shift+O");
	});
	it("has words for every preset", () => {
		expect(QUICK_ASK_PRESETS.map((p) => acceleratorWords(p, "darwin"))).toEqual([
			"Option+Space",
			"Control+Shift+Space",
			"Cmd+Shift+O",
		]);
		expect(QUICK_ASK_PRESETS.map((p) => acceleratorWords(p, "win32"))).toEqual([
			"Alt+Space",
			"Ctrl+Shift+Space",
			"Ctrl+Shift+O",
		]);
	});
});

const dots = [
	{ id: "dot_inbox1", name: "Inbox" },
	{ id: "dot_cal001", name: "Calendar" },
	{ id: "dot_cal002", name: "Cal" },
	{ id: "dot_daily1", name: "Daily Planner" },
];

describe("mention autocomplete", () => {
	it("finds the @query at the caret", () => {
		expect(activeMention("@In")).toEqual({ query: "In", start: 0 });
		expect(activeMention("hello @Cal")).toEqual({ query: "Cal", start: 6 });
		expect(activeMention("hello@Cal")).toBeUndefined();
		expect(activeMention("@Inbox hi")).toBeUndefined();
		expect(activeMention("@")).toEqual({ query: "", start: 0 });
		expect(activeMention("a @Ca tail", 5)).toEqual({ query: "Ca", start: 2 });
	});
	it("filters by prefix and limits", () => {
		expect(filterMentionTargets(dots, "ca").map((d) => d.name)).toEqual(["Calendar", "Cal"]);
		expect(filterMentionTargets(dots, "").length).toBe(4);
		expect(filterMentionTargets(dots, "", 2).length).toBe(2);
		expect(filterMentionTargets(dots, "zzz")).toEqual([]);
	});
	it("inserts the picked name", () => {
		expect(insertMention("@In", { start: 0 }, "Inbox")).toEqual({ text: "@Inbox ", caret: 7 });
		expect(insertMention("ask @Da now", { start: 4 }, "Daily Planner", 7)).toEqual({
			text: "ask @Daily Planner now",
			caret: 19,
		});
	});
});

describe("parseMention", () => {
	it("routes @Name at the start and strips it", () => {
		const r = parseMention("@Inbox what is new?", dots);
		expect(r.target?.id).toBe("dot_inbox1");
		expect(r.text).toBe("what is new?");
	});
	it("is case-insensitive and handles punctuation after the name", () => {
		expect(parseMention("@inbox, anything urgent?", dots)).toMatchObject({
			target: { id: "dot_inbox1" },
			text: "anything urgent?",
		});
	});
	it("finds a mention in the middle or at the end", () => {
		expect(parseMention("anything urgent @Inbox", dots)).toMatchObject({
			target: { id: "dot_inbox1" },
			text: "anything urgent",
		});
		expect(parseMention("check @Inbox for bills", dots)).toMatchObject({ text: "check for bills" });
	});
	it("prefers the longest name", () => {
		expect(parseMention("@Calendar tomorrow?", dots).target?.id).toBe("dot_cal001");
		expect(parseMention("@Cal tomorrow?", dots).target?.id).toBe("dot_cal002");
	});
	it("supports names with spaces", () => {
		expect(parseMention("@Daily Planner plan my day", dots)).toMatchObject({
			target: { id: "dot_daily1" },
			text: "plan my day",
		});
	});
	it("does not match part of a longer word or an email address", () => {
		expect(parseMention("@Inboxes are full", dots).target).toBeUndefined();
		expect(parseMention("mail me at bob@Inbox.com", dots).target).toBeUndefined();
	});
	it("leaves unknown mentions and plain questions for SuperDot", () => {
		expect(parseMention("@Nobody hi", dots)).toEqual({ text: "@Nobody hi" });
		expect(parseMention("  what's new?  ", dots)).toEqual({ text: "what's new?" });
	});
	it("returns empty text when only the mention was typed", () => {
		expect(parseMention("@Inbox", dots)).toMatchObject({ target: { id: "dot_inbox1" }, text: "" });
	});
});
