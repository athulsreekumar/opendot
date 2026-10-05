import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { readEnv } from "@/lib/env";

export type LimitResult = { ok: boolean; retryAfter?: number };
export type Limiter = (ip: string) => Promise<LimitResult>;

export const MAX_REQUESTS = 5;
export const WINDOW_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 10_000;

type MemoryOptions = { now?: () => number; max?: number; windowMs?: number; maxEntries?: number };

/** In-memory sliding-window limiter (per server instance). Bounded Map with expiry cleanup. */
export function createMemoryLimiter(opts: MemoryOptions = {}): Limiter {
	const now = opts.now ?? Date.now;
	const max = opts.max ?? MAX_REQUESTS;
	const windowMs = opts.windowMs ?? WINDOW_MS;
	const maxEntries = opts.maxEntries ?? MAX_ENTRIES;
	const hits = new Map<string, number[]>();
	let lastSweep = now();

	function sweep(t: number) {
		for (const [key, stamps] of hits) {
			const last = stamps[stamps.length - 1];
			if (last === undefined || last <= t - windowMs) hits.delete(key);
		}
		lastSweep = t;
	}

	return async (ip) => {
		const t = now();
		if (t - lastSweep >= windowMs / 10 || hits.size >= maxEntries) sweep(t);
		// Still full after sweeping: evict the oldest inserted key (Map keeps insertion order).
		while (hits.size >= maxEntries && !hits.has(ip)) {
			const oldest = hits.keys().next().value;
			if (oldest === undefined) break;
			hits.delete(oldest);
		}
		const stamps = (hits.get(ip) ?? []).filter((s) => s > t - windowMs);
		if (stamps.length >= max) {
			hits.set(ip, stamps);
			const first = stamps[0] ?? t;
			return { ok: false, retryAfter: Math.max(1, Math.ceil((first + windowMs - t) / 1000)) };
		}
		stamps.push(t);
		hits.delete(ip); // re-insert so recently active keys are evicted last
		hits.set(ip, stamps);
		return { ok: true };
	};
}

let singleton: Limiter | undefined;

/** 5 requests / 10 minutes per IP. Upstash when both env vars are set, otherwise in-memory. */
export const limit: Limiter = (ip) => {
	if (!singleton) {
		const env = readEnv();
		if (env.upstashUrl && env.upstashToken) {
			const rl = new Ratelimit({
				redis: new Redis({ url: env.upstashUrl, token: env.upstashToken }),
				limiter: Ratelimit.slidingWindow(MAX_REQUESTS, "10 m"),
				prefix: "opendot:early-access",
			});
			const memory = createMemoryLimiter();
			singleton = async (key) => {
				try {
					const r = await rl.limit(key);
					return r.success
						? { ok: true }
						: { ok: false, retryAfter: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
				} catch {
					// Redis unreachable: fail open to the in-memory limiter rather than blocking signups.
					return memory(key);
				}
			};
		} else {
			singleton = createMemoryLimiter();
		}
	}
	return singleton(ip);
};
