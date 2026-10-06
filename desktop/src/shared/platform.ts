// One place for what differs per OS. The built-in "mac" connection keeps its internal type name on every platform
// (so stored data never needs migrating); on Windows it is shown as "This PC" with the features that exist there.

/** Features that need macOS (JXA / osascript): Calendar, Reminders, Contacts and Notes. */
export const MAC_ONLY_FEATURES = ["calendar", "reminders", "contacts", "notes"] as const;

/** Watcher sources that need macOS. */
export const MAC_ONLY_WATCHERS = ["mac-calendar", "mac-reminders"] as const;

export const GIT_FOR_WINDOWS_URL = "https://git-scm.com/download/win";
export const SHELL_NEEDS_GIT_NOTE = "Shell needs Git for Windows (git-scm.com). Install it and restart OpenDot.";

/** Only Windows loses features; macOS keeps all of them and Linux (development only) is left as it was. */
export function platformFeatures<T extends string>(features: readonly T[], platform: string): T[] {
	return platform === "win32"
		? features.filter((f) => !(MAC_ONLY_FEATURES as readonly string[]).includes(f))
		: [...features];
}

export function builtinComputerLabel(platform: string): string {
	return platform === "win32" ? "This PC" : "This Mac";
}

export function builtinComputerDescription(platform: string): string {
	return platform === "win32"
		? "Files, shell, screen, clipboard, notifications and opening apps and links."
		: "Files, shell, Calendar, Reminders, Contacts, Notes, screen, clipboard and more.";
}
