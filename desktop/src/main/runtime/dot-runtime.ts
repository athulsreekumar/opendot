// Map<dotId, DotHost>, run slots, idle reaper and the always-on supervisor (spec 03 §8, spec 12 §2.4).
import type { Dot, DotHealth, DotId } from "../../shared/types";
import { log } from "../log";
import { DotHost, type DotHostDeps } from "./dot-host";

class Semaphore {
	private active = 0;
	private waiters: Array<() => void> = [];
	constructor(private max: () => number) {}
	async acquire(): Promise<() => void> {
		if (this.active >= this.max()) await new Promise<void>((r) => this.waiters.push(r));
		this.active++;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.active--;
			this.waiters.shift()?.();
		};
	}
}

const BACKOFF = [5, 30, 120, 600, 1800];

interface SupervisorState {
	failures: number;
	restarts: number;
	nextRetry?: number;
	lastError?: string;
	configError?: boolean;
}

export interface HealthDeps {
	listDots: () => Promise<Dot[]>;
	watchers: (dotId: DotId) => DotHealth["watchers"];
	queued: (dotId: DotId) => number;
	overBudget: (dotId: DotId) => string | undefined;
	turnsLastHour: (dotId: DotId) => number;
	costToday: (dotId: DotId) => number;
	paused: () => Promise<boolean>;
	emitHealth: (h: DotHealth) => void;
	notifyError: (dot: Dot, message: string) => void;
	idleMinutes: () => Promise<number>;
	hasPendingApprovals: (dotId: DotId) => boolean;
}

export class DotRuntime {
	private hosts = new Map<DotId, DotHost>();
	private sem: Semaphore;
	private sup = new Map<DotId, SupervisorState>();
	private reaper: ReturnType<typeof setInterval> | undefined;
	private lastHealth = new Map<DotId, { json: string; at: number }>();

	constructor(
		private readonly hostDeps: Omit<DotHostDeps, "acquireRunSlot">,
		private readonly health: HealthDeps,
		maxConcurrent: () => number,
	) {
		this.sem = new Semaphore(maxConcurrent);
	}

	get(dotId: DotId): DotHost {
		let h = this.hosts.get(dotId);
		if (!h || h.disposed) {
			h = new DotHost({ ...this.hostDeps, acquireRunSlot: () => this.sem.acquire() }, dotId);
			this.hosts.set(dotId, h);
		}
		return h;
	}

	peek(dotId: DotId): DotHost | undefined {
		return this.hosts.get(dotId);
	}

	all(): DotHost[] {
		return [...this.hosts.values()];
	}

	async disposeDot(dotId: DotId): Promise<void> {
		const h = this.hosts.get(dotId);
		this.hosts.delete(dotId);
		this.sup.delete(dotId);
		await h?.dispose();
	}

	async disposeAll(): Promise<void> {
		if (this.reaper) clearInterval(this.reaper);
		await Promise.race([
			Promise.all([...this.hosts.values()].map((h) => h.dispose())),
			new Promise((r) => setTimeout(r, 3000)),
		]);
		this.hosts.clear();
	}

	start(): void {
		this.reaper = setInterval(() => void this.reap(), 60_000);
		this.reaper.unref?.();
		void this.superviseAll();
	}

	/** Warm sessions of always-on Dots; retry failures with backoff. */
	async superviseAll(): Promise<void> {
		for (const d of await this.health.listDots()) {
			if (d.alwaysOn.enabled && !d.archived) await this.warm(d);
			this.pushHealth(d.id);
		}
	}

	async warm(dot: Dot): Promise<void> {
		const st = this.sup.get(dot.id) ?? { failures: 0, restarts: 0 };
		this.sup.set(dot.id, st);
		if (st.configError) return;
		if (st.nextRetry && Date.now() < st.nextRetry) return;
		try {
			await this.get(dot.id).ensureSession();
			if (st.failures) st.restarts++;
			st.failures = 0;
			st.lastError = undefined;
			st.nextRetry = undefined;
		} catch (e) {
			this.fail(dot, e);
		}
		this.pushHealth(dot.id);
	}

	/** Record a delivery/session failure (spec 12 §2.4). */
	fail(dot: Dot, e: unknown): void {
		const st = this.sup.get(dot.id) ?? { failures: 0, restarts: 0 };
		const msg = e instanceof Error ? e.message : String(e);
		const code = (e as { code?: string }).code;
		st.lastError = msg;
		if (code === "NO_MODEL" || /API key was rejected|401/.test(msg)) {
			if (!st.configError) this.health.notifyError(dot, `${dot.name} stopped: ${msg}`);
			st.configError = true;
		} else {
			st.nextRetry = Date.now() + (BACKOFF[Math.min(st.failures, BACKOFF.length - 1)] ?? 1800) * 1000;
			st.failures++;
			setTimeout(
				() => void this.retry(dot.id),
				(BACKOFF[Math.min(st.failures - 1, BACKOFF.length - 1)] ?? 1800) * 1000,
			).unref?.();
		}
		this.sup.set(dot.id, st);
		log.warn(`[supervisor] ${dot.name}: ${msg}`);
		this.pushHealth(dot.id);
	}

	private async retry(dotId: DotId): Promise<void> {
		const dot = (await this.health.listDots()).find((d) => d.id === dotId);
		if (dot?.alwaysOn.enabled) await this.warm(dot);
	}

	/** Config changed (model, key): clear a config error so the Dot can run again. */
	clearConfigErrors(): void {
		for (const st of this.sup.values()) {
			st.configError = false;
			st.nextRetry = undefined;
		}
		void this.superviseAll();
	}

	private async reap(): Promise<void> {
		const idleMs = (await this.health.idleMinutes()) * 60_000;
		const dots = await this.health.listDots();
		for (const h of this.hosts.values()) {
			const d = dots.find((x) => x.id === h.dotId);
			if (!d) continue;
			if (d.alwaysOn.enabled) continue;
			if (h.isBusy || this.health.hasPendingApprovals(h.dotId)) continue;
			if (Date.now() - h.lastActivity > idleMs && h.isWarm) await h.disposeSessions();
		}
	}

	async computeHealth(dotId: DotId): Promise<DotHealth | undefined> {
		const dot = (await this.health.listDots()).find((d) => d.id === dotId);
		if (!dot) return undefined;
		const st = this.sup.get(dotId);
		const h = this.hosts.get(dotId);
		const paused = await this.health.paused();
		const over = this.health.overBudget(dotId);
		let state: DotHealth["state"];
		if (!dot.alwaysOn.enabled) state = h?.isBusy ? "running" : "off";
		else if (paused) state = "paused";
		else if (st?.configError) state = "error";
		else if (st?.failures) state = "backoff";
		else if (over) state = "over-budget";
		else state = "running";
		return {
			dotId,
			state,
			alwaysOn: dot.alwaysOn.enabled,
			sessionWarm: !!h?.isWarm,
			queuedEvents: this.health.queued(dotId),
			turnsLastHour: this.health.turnsLastHour(dotId),
			costTodayUsd: Math.round(this.health.costToday(dotId) * 10000) / 10000,
			watchers: this.health.watchers(dotId),
			lastError: st?.lastError ?? over,
			restarts: st?.restarts ?? 0,
		};
	}

	/** Emit runtime:health, throttled to 1/s per Dot and only on change. */
	pushHealth(dotId: DotId): void {
		void this.computeHealth(dotId).then((h) => {
			if (!h) return;
			const json = JSON.stringify(h);
			const prev = this.lastHealth.get(dotId);
			if (prev?.json === json) return;
			const now = Date.now();
			if (prev && now - prev.at < 1000) {
				setTimeout(() => this.pushHealth(dotId), 1000 - (now - prev.at)).unref?.();
				return;
			}
			this.lastHealth.set(dotId, { json, at: now });
			this.health.emitHealth(h);
		});
	}

	async allHealth(): Promise<DotHealth[]> {
		const out: DotHealth[] = [];
		for (const d of await this.health.listDots()) {
			const h = await this.computeHealth(d.id);
			if (h) out.push(h);
		}
		return out;
	}
}
