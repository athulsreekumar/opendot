// Quick-ask bar: settings defaults, accelerator presets and labels, @mention parsing. Pure, used by main and renderer.
import type { QuickAskSettings } from "./types";

export const QUICK_ASK_DEFAULT_SHORTCUT = "Alt+Space";
export const QUICK_ASK_IN_USE = "That shortcut is in use by another app.";

/** The shortcuts offered in Settings. Anything else in settings.json falls back to the default. */
export const QUICK_ASK_PRESETS = ["Alt+Space", "Ctrl+Shift+Space", "CommandOrControl+Shift+O"] as const;

export interface QuickAskStatus {
	enabled: boolean;
	accelerator: string;
	registered: boolean;
	/** Why the shortcut isn't active (for example it is taken by another app). */
	error?: string;
}

export function defaultQuickAsk(): QuickAskSettings {
	return { enabled: true, shortcut: QUICK_ASK_DEFAULT_SHORTCUT };
}

export function isPresetShortcut(s: string): boolean {
	return (QUICK_ASK_PRESETS as readonly string[]).includes(s);
}

/** Settings with defaults filled in. Old settings files have no `quickAsk` at all. */
export function resolveQuickAsk(settings?: { quickAsk?: Partial<QuickAskSettings> } | null): QuickAskSettings {
	const q = settings?.quickAsk;
	const def = defaultQuickAsk();
	return {
		enabled: typeof q?.enabled === "boolean" ? q.enabled : def.enabled,
		shortcut: typeof q?.shortcut === "string" && isPresetShortcut(q.shortcut) ? q.shortcut : def.shortcut,
	};
}

const MAC_GLYPHS: Record<string, string> = {
	Alt: "⌥",
	Option: "⌥",
	Ctrl: "⌃",
	Control: "⌃",
	Shift: "⇧",
	Cmd: "⌘",
	Command: "⌘",
	CommandOrControl: "⌘",
	CmdOrCtrl: "⌘",
};

/** Short label as printed in tips: "⌥Space" on a Mac, "Alt+Space" elsewhere. */
export function acceleratorLabel(accelerator: string, platform: string): string {
	const parts = accelerator.split("+");
	if (platform === "darwin") return parts.map((p) => MAC_GLYPHS[p] ?? p).join("");
	return parts.map((p) => (p === "CommandOrControl" || p === "CmdOrCtrl" || p === "Cmd" ? "Ctrl" : p)).join("+");
}

/** Words for the Settings select: "Option+Space" on a Mac, "Alt+Space" elsewhere. */
export function acceleratorWords(accelerator: string, platform: string): string {
	const mac = platform === "darwin";
	return accelerator
		.split("+")
		.map((p) => {
			if (p === "CommandOrControl" || p === "CmdOrCtrl") return mac ? "Cmd" : "Ctrl";
			if (p === "Alt") return mac ? "Option" : "Alt";
			if (p === "Ctrl") return mac ? "Control" : "Ctrl";
			return p;
		})
		.join("+");
}

// ───────────────────────── @mentions ─────────────────────────

export interface MentionTarget {
	id: string;
	name: string;
}

/** The `@query` being typed at the caret, if any. */
export function activeMention(text: string, caret = text.length): { query: string; start: number } | undefined {
	const before = text.slice(0, caret);
	const m = /(^|\s)@([^\s@]*)$/.exec(before);
	return m ? { query: m[2]!, start: before.length - m[2]!.length - 1 } : undefined;
}

/** Dots whose name starts with the query, in the given order. */
export function filterMentionTargets<T extends MentionTarget>(dots: T[], query: string, limit = 6): T[] {
	const q = query.toLowerCase();
	return dots.filter((d) => d.name.toLowerCase().startsWith(q)).slice(0, limit);
}

/** Replace the `@query` at `start` (up to the caret) with `@Name `. Returns the new text and caret. */
export function insertMention(
	text: string,
	mention: { start: number },
	name: string,
	caret = text.length,
): { text: string; caret: number } {
	const before = text.slice(0, mention.start);
	const after = text.slice(caret);
	const next = `${before}@${name} ${after.replace(/^\s+/, "")}`;
	return { text: next, caret: before.length + name.length + 2 };
}

const NAME_END = /[\s,.:;!?)]/;

/**
 * Find the first `@Name` that names one of the Dots (longest name wins, case-insensitive, so "Cal" never steals
 * "@Calendar"). Returns that Dot and the text with the mention taken out. Without a match the text is untouched.
 */
export function parseMention<T extends MentionTarget>(text: string, dots: T[]): { target?: T; text: string } {
	const byLength = [...dots].sort((a, b) => b.name.length - a.name.length);
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== "@" || (i > 0 && !/\s/.test(text[i - 1]!))) continue;
		const after = text.slice(i + 1);
		const lower = after.toLowerCase();
		for (const d of byLength) {
			const name = d.name.toLowerCase();
			if (!name || !lower.startsWith(name)) continue;
			const next = after[name.length];
			if (next !== undefined && !NAME_END.test(next)) continue;
			const head = text.slice(0, i).trimEnd();
			const tail = after.slice(name.length).replace(/^[\s,:;]+/, "");
			return { target: d, text: [head, tail].filter(Boolean).join(" ").trim() };
		}
	}
	return { text: text.trim() };
}
