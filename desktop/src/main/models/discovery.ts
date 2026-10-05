import type { SelfHostedPreset } from "../../shared/types";
import { SELF_HOSTED_PRESETS } from "./provider-presets";

/** Discover model ids from an Ollama or OpenAI-compatible server (spec 04 §3). */
export async function discoverModels(
	baseUrl: string,
	kind: "ollama" | "openai",
	opts: { fetch?: typeof fetch; apiKey?: string; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<Array<{ id: string; label?: string }>> {
	const f = opts.fetch ?? fetch;
	const signal = AbortSignal.timeout(opts.timeoutMs ?? 5000);
	const headers: Record<string, string> = { ...(opts.headers ?? {}) };
	if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
	if (kind === "ollama") {
		const root = baseUrl.replace(/\/v1\/?$/, "");
		const res = await f(`${root}/api/tags`, { headers, signal });
		if (!res.ok) throw new Error(`HTTP ${res.status} from ${root}/api/tags`);
		const json = (await res.json()) as { models?: Array<{ name: string }> };
		return (json.models ?? []).map((m) => ({ id: m.name }));
	}
	const url = `${baseUrl.replace(/\/$/, "")}/models`;
	const res = await f(url, { headers, signal });
	if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
	const json = (await res.json()) as { data?: Array<{ id: string }> };
	return (json.data ?? []).map((m) => ({ id: m.id }));
}

/** Probe default local server ports in parallel (600 ms each). */
export async function detectLocalServers(
	f: typeof fetch = fetch,
): Promise<Array<{ preset: SelfHostedPreset; baseUrl: string }>> {
	const entries = Object.entries(SELF_HOSTED_PRESETS) as Array<
		[SelfHostedPreset, (typeof SELF_HOSTED_PRESETS)["ollama"]]
	>;
	const results = await Promise.all(
		entries.map(async ([preset, p]) => {
			try {
				await discoverModels(p.baseUrl, p.discovery, { fetch: f, timeoutMs: 600 });
				return { preset, baseUrl: p.baseUrl };
			} catch {
				return undefined;
			}
		}),
	);
	return results.filter((r): r is { preset: SelfHostedPreset; baseUrl: string } => !!r);
}

export function friendlyNetworkError(e: unknown, url?: string): string {
	const msg = e instanceof Error ? `${e.message} ${(e as { cause?: { code?: string } }).cause?.code ?? ""}` : String(e);
	if (/ECONNREFUSED|fetch failed/i.test(msg))
		return `Nothing is listening at ${url ?? "that address"}. Is the server running?`;
	if (/401|403|unauthori[sz]ed|invalid.*key|api key/i.test(msg)) return "The API key was rejected.";
	if (/404/.test(msg)) return "Model not found on this server.";
	if (/timeout|aborted/i.test(msg)) return "No response in time.";
	return msg.trim().slice(0, 300);
}
