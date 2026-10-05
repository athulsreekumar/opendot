// JXA helpers. Scripts must embed user values ONLY through jsString(); never concatenate raw input.
import { execFile } from "node:child_process";

export function runJxaReal(script: string, timeoutMs = 15000): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"osascript",
			["-l", "JavaScript", "-e", script],
			{ timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
			(err, stdout, stderr) => {
				if (err) {
					const e = err as Error & { stderr?: string };
					e.stderr = String(stderr ?? "");
					e.message = `${e.message}\n${e.stderr}`.trim();
					reject(e);
					return;
				}
				resolve(String(stdout).trim());
			},
		);
	});
}

export function isNotAuthorized(err: unknown): boolean {
	const msg = err instanceof Error ? `${err.message} ${(err as { stderr?: string }).stderr ?? ""}` : String(err);
	return msg.includes("-1743") || /Not authorized to send Apple events/i.test(msg);
}

/** Safe JS literal for embedding a user value inside a JXA script. */
export function jsString(v: unknown): string {
	// U+2028/2029 are valid in JSON but historically broke JS string literals; escape them too.
	return (JSON.stringify(v) ?? "null")
		.split(String.fromCharCode(0x2028))
		.join("\\u2028")
		.split(String.fromCharCode(0x2029))
		.join("\\u2029");
}

export const SETTINGS_HINT =
	"Open System Settings > Privacy & Security > Automation (or the matching Privacy pane) and allow OpenDot.";

/** Run a JXA script that prints JSON; parse it. Maps -1743 to a clear error. */
export async function runJxaJson<T>(
	run: (script: string, timeoutMs?: number) => Promise<string>,
	script: string,
	app: string,
): Promise<T> {
	let out: string;
	try {
		out = await run(script);
	} catch (err) {
		if (isNotAuthorized(err)) throw new Error(`OpenDot is not allowed to control ${app}. ${SETTINGS_HINT}`);
		throw err;
	}
	try {
		return JSON.parse(out) as T;
	} catch {
		throw new Error(`Unexpected output from ${app}`);
	}
}

export function textResult(text: string, details?: unknown) {
	return { content: [{ type: "text" as const, text }], details: details ?? {} };
}
