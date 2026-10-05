// Authenticated Google API fetch: Bearer token, 401 refresh-retry once, 429 Retry-After once. Spec 05 §5.
import type { NativeToolDeps } from "../native-types";

const MAX_RETRY_WAIT_MS = 10_000;

async function errorMessage(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	try {
		const j = JSON.parse(text) as { error?: { message?: string } | string; error_description?: string };
		if (typeof j.error === "string") return j.error_description ?? j.error;
		if (j.error?.message) return j.error.message;
	} catch {
		// not JSON
	}
	return text.slice(0, 300) || res.statusText || "request failed";
}

export async function googleFetch(deps: NativeToolDeps, url: string, init: RequestInit = {}): Promise<unknown> {
	const raw = await googleFetchRaw(deps, url, init);
	const text = await raw.text();
	if (!text) return {};
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/** Same as googleFetch but returns the (ok) Response so callers can read text/arrayBuffer. */
export async function googleFetchRaw(deps: NativeToolDeps, url: string, init: RequestInit = {}): Promise<Response> {
	const call = async (token: string) => {
		const headers = new Headers(init.headers);
		headers.set("Authorization", `Bearer ${token}`);
		if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
		return deps.fetch(url, { ...init, headers });
	};
	let res = await call(await deps.getAccessToken());
	if (res.status === 401) res = await call(await deps.getAccessToken());
	if (res.status === 429) {
		const secs = Number(res.headers.get("Retry-After"));
		const wait = Number.isFinite(secs) && secs > 0 ? Math.min(secs * 1000, MAX_RETRY_WAIT_MS) : 1000;
		await new Promise((r) => setTimeout(r, wait));
		res = await call(await deps.getAccessToken());
	}
	if (!res.ok) throw new Error(`Google API error ${res.status}: ${await errorMessage(res)}`);
	return res;
}

const MAX_TEXT = 8 * 1024;

/** Clip text to the 8 KB tool-result budget (spec 05 §5). */
export function clip(text: string, max = MAX_TEXT): string {
	return text.length <= max ? text : `${text.slice(0, max - 20)}\n… [truncated]`;
}

export function textResult<D>(text: string, details: D) {
	return { content: [{ type: "text" as const, text: clip(text) }], details };
}

export const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: true } as const;
