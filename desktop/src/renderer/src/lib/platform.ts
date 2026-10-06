// OS the renderer is running on, read from the user agent (synchronous, so first paint is already right).
const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;

export const isMac = /Macintosh|Mac OS X/.test(ua);
export const isWindows = /Windows/.test(ua);

/** The modifier key as people read it on this OS. */
export const modKey = isMac ? "⌘" : "Ctrl";

/** Label for the shortcut Mod+key, e.g. "⌘K" or "Ctrl+K". */
export function shortcut(key: string): string {
	return isMac ? `⌘${key}` : `Ctrl+${key}`;
}
