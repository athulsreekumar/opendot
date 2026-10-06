// Launch an application by name. Names come from a model, so each platform gets a validated, shell-free invocation.
import { execFile } from "node:child_process";

type Exec = (file: string, args: string[], cb: (err: Error | null) => void) => unknown;

/** Letters, digits, spaces and . _ - + ( ) ' only: nothing cmd.exe treats specially (& | < > ^ % " and path separators). */
const WINDOWS_APP_NAME = /^[\p{L}\p{N} ._\-+()']{1,80}$/u;

/** The command and arguments that launch `name` on `platform`; throws for names that are not safe to pass on. */
export function openAppCommand(name: string, platform: string): { file: string; args: string[] } {
	const n = name.trim();
	if (!n || n.startsWith("-") || n.length > 200 || [...n].some((ch) => ch.charCodeAt(0) < 32))
		throw new Error("Invalid app name");
	if (platform === "darwin") return { file: "open", args: ["-a", n] };
	if (platform === "win32") {
		if (!WINDOWS_APP_NAME.test(n)) throw new Error("Invalid app name");
		// `start` resolves registered apps (App Paths) and anything on PATH; the empty string is its window title.
		return { file: "cmd.exe", args: ["/d", "/s", "/c", "start", "", n] };
	}
	return { file: "xdg-open", args: [n] };
}

export function openAppByName(
	name: string,
	platform: string = process.platform,
	run: Exec = (f, a, cb) => execFile(f, a, { windowsHide: true }, (e) => cb(e)),
): Promise<void> {
	const { file, args } = openAppCommand(name, platform);
	return new Promise((res, rej) => run(file, args, (e) => (e ? rej(e) : res())));
}
