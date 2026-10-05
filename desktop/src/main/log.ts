// Logging that never writes secrets or payloads. Uses electron-log when running inside Electron,
// console otherwise (unit tests).
type Level = "debug" | "info" | "warn" | "error";
const secrets = new Set<string>();

export function registerSecretForRedaction(value: string): void {
	if (value && value.length >= 6) secrets.add(value);
}

export function redactSecrets(s: string): string {
	let out = s;
	for (const v of secrets) out = out.split(v).join("••••");
	return out
		.replace(/sk-[A-Za-z0-9_-]{12,}/g, "sk-••••")
		.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, "Bearer ••••")
		.replace(/gh[pousr]_[A-Za-z0-9]{20,}/g, "gh_••••");
}

type Sink = Record<Level, (...a: unknown[]) => void>;
let sink: Sink = {
	debug: () => undefined,
	info: (...a) => console.info(...a),
	warn: (...a) => console.warn(...a),
	error: (...a) => console.error(...a),
};

export function setLogSink(s: Sink): void {
	sink = s;
}

function fmt(args: unknown[]): string {
	return redactSecrets(
		args
			.map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ""}` : typeof a === "string" ? a : safeJson(a)))
			.join(" "),
	);
}
function safeJson(v: unknown): string {
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}

export const log = {
	debug: (...a: unknown[]) => sink.debug(fmt(a)),
	info: (...a: unknown[]) => sink.info(fmt(a)),
	warn: (...a: unknown[]) => sink.warn(fmt(a)),
	error: (...a: unknown[]) => sink.error(fmt(a)),
};
export type Logger = typeof log;
