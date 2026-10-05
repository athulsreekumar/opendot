// Minimal Microsoft Graph HTTP helper (spec 05 §5): Bearer auth, 401 → retry once, 429 → honour Retry-After once.
import type { NativeToolDeps } from "../native-types";

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MAX_RETRY_AFTER_SEC = 10;

export type GraphDeps = Pick<NativeToolDeps, "fetch" | "getAccessToken">;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function errorMessage(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	try {
		const j = JSON.parse(text) as { error?: { message?: string; code?: string } };
		if (j.error?.message) return j.error.message;
		if (j.error?.code) return j.error.code;
	} catch {
		// not JSON
	}
	return text.slice(0, 200) || res.statusText || "request failed";
}

/** Fetch a Graph path (or absolute URL such as an @odata.nextLink). Throws a readable Error on non-2xx. */
export async function graphFetch(deps: GraphDeps, pathOrUrl: string, init: RequestInit = {}): Promise<Response> {
	const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
	let retried401 = false;
	let retried429 = false;
	for (;;) {
		const token = await deps.getAccessToken();
		const headers = new Headers(init.headers);
		headers.set("Authorization", `Bearer ${token}`);
		if (!headers.has("Accept")) headers.set("Accept", "application/json");
		const res = await deps.fetch(url, { ...init, headers });
		if (res.ok) return res;
		if (res.status === 401 && !retried401) {
			retried401 = true;
			continue;
		}
		if (res.status === 429 && !retried429) {
			const wait = Number(res.headers.get("Retry-After") ?? "1");
			if (Number.isFinite(wait) && wait <= MAX_RETRY_AFTER_SEC) {
				retried429 = true;
				await sleep(Math.max(0, wait) * 1000);
				continue;
			}
		}
		throw new Error(`Microsoft Graph error ${res.status}: ${await errorMessage(res)}`);
	}
}

export async function graphJson<T = unknown>(deps: GraphDeps, pathOrUrl: string, init?: RequestInit): Promise<T> {
	const res = await graphFetch(deps, pathOrUrl, init);
	if (res.status === 204) return undefined as T;
	const text = await res.text();
	return (text ? JSON.parse(text) : undefined) as T;
}

export function stripHtml(html: string): string {
	return html
		.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
		.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

const MAX_RESULT_BYTES = 8 * 1024;

/** Concise text tool result, capped at 8 KB. */
export function textResult<D>(text: string, details: D) {
	let out = text;
	if (Buffer.byteLength(out, "utf8") > MAX_RESULT_BYTES) {
		out = `${Buffer.from(out, "utf8")
			.subarray(0, MAX_RESULT_BYTES - 40)
			.toString("utf8")}\n… (truncated)`;
	}
	return { content: [{ type: "text" as const, text: out }], details };
}

export function oneLine(s: string | null | undefined, max = 120): string {
	const t = (s ?? "").replace(/\s+/g, " ").trim();
	return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
