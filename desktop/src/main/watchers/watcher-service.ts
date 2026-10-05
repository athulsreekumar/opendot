// Scheduler, cursors, dedupe and backoff for watchers (spec 12 §2.1).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type { Dot, DotEventView, DotId, Watcher, WatcherConfig, WatcherId, WatcherType } from "../../shared/types";
import { log } from "../log";
import type { Paths } from "../paths";
import type { Store } from "../store/store";
import { PUSH_TYPES, SOURCES, sourceFor } from "./sources";
import { NeedsAuthError, type NewEvent, type SourceDeps } from "./types";

const MAX_INFLIGHT = 4;
const MAX_BACKOFF_SEC = 1800;

export interface WatcherServiceDeps {
	store: Store;
	paths: Paths;
	sourceDeps: SourceDeps;
	getDot: (id: DotId) => Promise<Dot | undefined>;
	isPaused: () => Promise<boolean>;
	/** Can this Dot use this source? (connection installed + granted) */
	availability: (dot: Dot, type: WatcherType) => Promise<{ available: boolean; reason?: string }>;
	onEvent: (dot: Dot, watcher: Watcher, ev: NewEvent) => void;
	onChanged: (w: Watcher) => void;
	webhookToken: (watcherId: WatcherId) => Promise<string>;
	webhookPort: () => number;
	minIntervalOverride?: number;
}

export class WatcherService {
	private timer: ReturnType<typeof setInterval> | undefined;
	private inflight = new Set<WatcherId>();
	private pushStops = new Map<WatcherId, () => Promise<void>>();
	private dedupe = new Map<WatcherId, string[]>();
	private persistTimer: ReturnType<typeof setTimeout> | undefined;
	private cache: Watcher[] = [];
	private suspended = false;

	constructor(private readonly deps: WatcherServiceDeps) {}

	async start(): Promise<void> {
		this.cache = await this.deps.store.watchers.read();
		this.timer = setInterval(() => void this.tick(), 1000);
		this.timer.unref?.();
		await this.syncPush();
	}

	async stop(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		for (const stop of this.pushStops.values()) await stop().catch(() => undefined);
		this.pushStops.clear();
		await this.flush();
	}

	setSuspended(s: boolean): void {
		this.suspended = s;
	}

	/** After wake / back online: run everything soon (staggered). */
	catchUp(): void {
		const now = Date.now();
		for (const w of this.cache) {
			if (!w.enabled) continue;
			w.nextRunAt = new Date(now + Math.random() * 10_000).toISOString();
		}
		this.schedulePersist();
	}

	list(dotId?: DotId): Watcher[] {
		return this.cache.filter((w) => !dotId || w.dotId === dotId);
	}

	types(): Array<{
		type: WatcherType;
		label: string;
		defaultIntervalSec: number;
		minIntervalSec: number;
		push: boolean;
	}> {
		return SOURCES.map((s) => ({
			type: s.type,
			label: s.label,
			defaultIntervalSec: s.defaultIntervalSec,
			minIntervalSec: s.minIntervalSec,
			push: PUSH_TYPES.includes(s.type),
		}));
	}

	async create(input: {
		dotId: DotId;
		type: WatcherType;
		label?: string;
		config: WatcherConfig;
		intervalSec?: number;
	}): Promise<Watcher> {
		const src = sourceFor(input.type);
		if (!src) throw new OpenDotError("UNKNOWN_SOURCE", `Unknown watcher type ${input.type}`);
		const config = src.configSchema.parse(input.config) as WatcherConfig;
		const min = this.deps.minIntervalOverride ?? src.minIntervalSec;
		const w: Watcher = {
			id: newId("wat"),
			dotId: input.dotId,
			type: input.type,
			label: (input.label || src.label).slice(0, 100),
			enabled: true,
			config,
			intervalSec: Math.max(min, input.intervalSec ?? src.defaultIntervalSec),
			state: "idle",
			failures: 0,
			nextRunAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		};
		this.cache.push(w);
		await this.persistNow();
		this.deps.onChanged(w);
		await this.syncPush();
		return w;
	}

	async update(
		id: WatcherId,
		patch: Partial<Pick<Watcher, "label" | "enabled" | "config" | "intervalSec">>,
	): Promise<Watcher> {
		const w = this.get(id);
		const src = sourceFor(w.type)!;
		if (patch.config) {
			w.config = src.configSchema.parse(patch.config) as WatcherConfig;
			w.cursor = undefined; // new config → new baseline
		}
		if (patch.label) w.label = patch.label.slice(0, 100);
		if (patch.intervalSec)
			w.intervalSec = Math.max(this.deps.minIntervalOverride ?? src.minIntervalSec, patch.intervalSec);
		if (patch.enabled !== undefined) {
			w.enabled = patch.enabled;
			w.state = patch.enabled ? "idle" : "paused";
			w.failures = 0;
			w.nextRunAt = new Date().toISOString();
		}
		await this.persistNow();
		this.deps.onChanged(w);
		await this.restartPush(w);
		return w;
	}

	async remove(id: WatcherId): Promise<void> {
		await this.stopPush(id);
		this.cache = this.cache.filter((w) => w.id !== id);
		await this.persistNow();
	}

	async removeForDot(dotId: DotId): Promise<void> {
		for (const w of this.cache.filter((x) => x.dotId === dotId)) await this.remove(w.id);
	}

	get(id: WatcherId): Watcher {
		const w = this.cache.find((x) => x.id === id);
		if (!w) throw new OpenDotError("NOT_FOUND", "Watcher not found.");
		return w;
	}

	async runNow(id: WatcherId): Promise<void> {
		const w = this.get(id);
		w.nextRunAt = new Date().toISOString();
		w.failures = 0;
		if (w.state === "needs-auth" || w.state === "backoff" || w.state === "error") w.state = "idle";
		await this.tick(true);
	}

	async test(input: {
		type: WatcherType;
		config: WatcherConfig;
		dotId: DotId;
	}): Promise<{ ok: boolean; message: string; sample?: DotEventView[] }> {
		const src = sourceFor(input.type);
		const dot = await this.deps.getDot(input.dotId);
		if (!src || !dot) return { ok: false, message: "Unknown watcher type or Dot." };
		let config: WatcherConfig;
		try {
			config = src.configSchema.parse(input.config) as WatcherConfig;
		} catch (e) {
			return { ok: false, message: (e as Error).message.slice(0, 300) };
		}
		const fake: Watcher = {
			id: "wat_test0000000" as WatcherId,
			dotId: dot.id,
			type: input.type,
			label: src.label,
			enabled: true,
			config,
			intervalSec: 60,
			state: "idle",
			failures: 0,
			createdAt: new Date().toISOString(),
		};
		try {
			const res = await src.test({
				watcher: fake,
				config,
				dot,
				deps: this.deps.sourceDeps,
				emit: () => undefined,
				signal: AbortSignal.timeout(30000),
			});
			return {
				ok: res.ok,
				message: res.message,
				sample: res.sample.slice(0, 3).map((e, i) => ({
					id: `sample_${i}`,
					type: input.type,
					title: e.title,
					facts: e.facts,
					importanceHint: e.importanceHint,
					occurredAt: e.occurredAt,
					status: "queued",
				})),
			};
		} catch (e) {
			return {
				ok: false,
				message: e instanceof NeedsAuthError ? "Sign in to the connection first." : (e as Error).message,
			};
		}
	}

	async webhookInfo(id: WatcherId): Promise<{ url: string; token: string; curl: string }> {
		const w = this.get(id);
		if (w.type !== "local-webhook") throw new OpenDotError("NOT_WEBHOOK", "Not a webhook watcher.");
		const token = await this.deps.webhookToken(id);
		const url = `http://127.0.0.1:${this.deps.webhookPort()}/hooks/${id}`;
		const curl = `curl -X POST ${url} -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"title":"Hello","body":"Something happened"}'`;
		return { url, token, curl };
	}

	// ───────── scheduling ─────────
	private async eligible(w: Watcher): Promise<Dot | undefined> {
		if (!w.enabled) return undefined;
		const dot = await this.deps.getDot(w.dotId);
		if (!dot || dot.archived || !dot.alwaysOn.enabled) return undefined;
		return dot;
	}

	private async tick(force = false): Promise<void> {
		if (this.suspended && !force) return;
		if (!force && (await this.deps.isPaused())) return;
		const now = Date.now();
		for (const w of this.cache) {
			if (this.inflight.size >= MAX_INFLIGHT) break;
			if (this.inflight.has(w.id) || (PUSH_TYPES.includes(w.type) && w.type !== "mcp-resource")) continue;
			if (w.state === "needs-auth") continue;
			if (w.nextRunAt && Date.parse(w.nextRunAt) > now) continue;
			const dot = await this.eligible(w);
			if (!dot) continue;
			void this.runPoll(w, dot);
		}
	}

	private async runPoll(w: Watcher, dot: Dot): Promise<void> {
		const src = sourceFor(w.type);
		if (!src?.poll) return;
		this.inflight.add(w.id);
		w.state = "running";
		this.deps.onChanged(w);
		try {
			const config = src.configSchema.parse(w.config);
			const res = await src.poll(
				{
					watcher: w,
					config,
					dot,
					deps: this.deps.sourceDeps,
					emit: (e) => this.emit(dot, w, e),
					signal: AbortSignal.timeout(120_000),
				},
				w.cursor,
			);
			w.cursor = res.cursor;
			for (const e of res.events) await this.emit(dot, w, e);
			w.state = "idle";
			w.failures = 0;
			w.lastError = undefined;
			w.nextRunAt = new Date(Date.now() + w.intervalSec * 1000 * (0.9 + Math.random() * 0.2)).toISOString();
		} catch (e) {
			if (e instanceof NeedsAuthError) {
				w.state = "needs-auth";
				w.lastError = "Sign in again in Connections.";
			} else {
				w.failures++;
				w.state = "backoff";
				w.lastError = friendly((e as Error).message);
				const delay = Math.min(w.intervalSec * 2 ** w.failures, MAX_BACKOFF_SEC);
				w.nextRunAt = new Date(Date.now() + delay * 1000).toISOString();
				log.warn(`watcher ${w.label} failed: ${w.lastError}`);
			}
		} finally {
			w.lastRunAt = new Date().toISOString();
			this.inflight.delete(w.id);
			this.deps.onChanged(w);
			this.schedulePersist();
		}
	}

	private async emit(dot: Dot, w: Watcher, e: NewEvent): Promise<void> {
		if (await this.isDuplicate(w, e.dedupeKey)) return;
		w.lastEventAt = new Date().toISOString();
		this.deps.onEvent(dot, w, e);
	}

	/** Called when a connection was re-authenticated: needs-auth watchers retry. */
	resetAuth(): void {
		for (const w of this.cache) {
			if (w.state === "needs-auth") {
				w.state = "idle";
				w.nextRunAt = new Date().toISOString();
			}
		}
	}

	// ───────── push sources ─────────
	async syncPush(): Promise<void> {
		for (const w of this.cache) {
			if (!PUSH_TYPES.includes(w.type)) continue;
			const dot = await this.eligible(w);
			const running = this.pushStops.has(w.id);
			if (dot && !running) await this.startPush(w, dot);
			else if (!dot && running) await this.stopPush(w.id);
		}
	}

	private async startPush(w: Watcher, dot: Dot): Promise<void> {
		const src = sourceFor(w.type);
		if (!src?.start) return;
		try {
			const stop = await src.start({
				watcher: w,
				config: src.configSchema.parse(w.config),
				dot,
				deps: this.deps.sourceDeps,
				emit: (e) => void this.emit(dot, w, e),
				signal: new AbortController().signal,
			});
			this.pushStops.set(w.id, stop);
			w.state = "idle";
			w.lastError = undefined;
		} catch (e) {
			w.state = "error";
			w.lastError = friendly((e as Error).message);
		}
		this.deps.onChanged(w);
	}

	private async stopPush(id: WatcherId): Promise<void> {
		const stop = this.pushStops.get(id);
		this.pushStops.delete(id);
		await stop?.().catch(() => undefined);
	}

	private async restartPush(w: Watcher): Promise<void> {
		if (!PUSH_TYPES.includes(w.type)) return;
		await this.stopPush(w.id);
		await this.syncPush();
	}

	// ───────── dedupe + persistence ─────────
	private async isDuplicate(w: Watcher, key: string): Promise<boolean> {
		let ring = this.dedupe.get(w.id);
		const file = this.deps.paths.dotDedupe(w.dotId, w.id);
		if (!ring) {
			try {
				ring = JSON.parse(await readFile(file, "utf8")) as string[];
			} catch {
				ring = [];
			}
			this.dedupe.set(w.id, ring);
		}
		if (ring.includes(key)) return true;
		ring.push(key);
		if (ring.length > 5000) ring.splice(0, ring.length - 5000);
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, JSON.stringify(ring), { mode: 0o600 }).catch(() => undefined);
		return false;
	}

	private schedulePersist(): void {
		if (this.persistTimer) return;
		this.persistTimer = setTimeout(() => {
			this.persistTimer = undefined;
			void this.persistNow();
		}, 1000);
	}

	private async persistNow(): Promise<void> {
		await this.deps.store.watchers.write(this.cache.map((w) => ({ ...w })));
	}

	async flush(): Promise<void> {
		if (this.persistTimer) clearTimeout(this.persistTimer);
		this.persistTimer = undefined;
		await this.persistNow();
	}
}

function friendly(msg: string): string {
	if (/ENOTFOUND|ECONNRESET|fetch failed|network/i.test(msg)) return "Network problem — will retry.";
	return msg.slice(0, 300);
}
