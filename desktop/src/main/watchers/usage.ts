// Per-Dot turns/cost buckets in ~/.opendot/usage.json (spec 12 §2.2).
import type { DotId } from "../../shared/types";
import type { Store } from "../store/store";

type Bucket = { turns: number; cost: number };

const hourKey = (d: Date) => d.toISOString().slice(0, 13);
const dayKey = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export class UsageTracker {
	private hourly: Record<string, Record<string, Bucket>> = {};
	private daily: Record<string, Record<string, Bucket>> = {};
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly store: Store) {}

	async load(): Promise<void> {
		const u = await this.store.usage.read();
		this.hourly = u.hourly;
		this.daily = u.daily;
	}

	private bump(dotId: DotId, turns: number, cost: number, now = new Date()): void {
		for (const [table, key] of [
			[this.hourly, hourKey(now)],
			[this.daily, dayKey(now)],
		] as const) {
			const perDot = table[dotId] ?? {};
			table[dotId] = perDot;
			const bucket = perDot[key] ?? { turns: 0, cost: 0 };
			perDot[key] = bucket;
			bucket.turns += turns;
			bucket.cost += cost;
		}
		this.schedule();
	}

	recordTurn(dotId: DotId): void {
		this.bump(dotId, 1, 0);
	}

	recordCost(dotId: DotId, cost: number): void {
		if (cost > 0) this.bump(dotId, 0, cost);
	}

	turnsLastHour(dotId: DotId, now = new Date()): number {
		const h = this.hourly[dotId] ?? {};
		const cur = h[hourKey(now)]?.turns ?? 0;
		const prev = h[hourKey(new Date(now.getTime() - 3600_000))]?.turns ?? 0;
		// Approximate rolling hour: current bucket + the overlapping share of the previous one.
		return cur + Math.round(prev * (1 - now.getMinutes() / 60));
	}

	costToday(dotId: DotId, now = new Date()): number {
		return this.daily[dotId]?.[dayKey(now)]?.cost ?? 0;
	}

	costTodayAll(now = new Date()): number {
		return Object.keys(this.daily).reduce((s, id) => s + this.costToday(id as DotId, now), 0);
	}

	private schedule(): void {
		if (this.timer) return;
		this.timer = setTimeout(() => {
			this.timer = undefined;
			void this.save();
		}, 2000);
	}

	async save(): Promise<void> {
		const cutoffH = hourKey(new Date(Date.now() - 48 * 3600_000));
		const cutoffD = dayKey(new Date(Date.now() - 90 * 86400_000));
		for (const m of Object.values(this.hourly)) for (const k of Object.keys(m)) if (k < cutoffH) delete m[k];
		for (const m of Object.values(this.daily)) for (const k of Object.keys(m)) if (k < cutoffD) delete m[k];
		await this.store.usage.write({ hourly: this.hourly, daily: this.daily });
	}
}
