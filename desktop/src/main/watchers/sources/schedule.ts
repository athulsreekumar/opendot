// schedule source (spec 12 §4): fires at computed times. Poll-based; the cursor is the ISO time of the next fire.
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

export const scheduleConfigSchema = z.object({
	mode: z.enum(["every", "daily", "weekly"]),
	everyMin: z.number().min(5).max(1440).optional(),
	times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).optional(),
	days: z.array(z.number().int().min(0).max(6)).optional(),
	timeZone: z.string(),
});
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

const MAX_LATE_MS = 6 * 3600_000;
const DAY_MS = 86_400_000;

function resolveTz(tz: string): string {
	if (!tz || tz === "local") return Intl.DateTimeFormat().resolvedOptions().timeZone;
	return tz;
}

function wallParts(date: Date, tz: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hourCycle: "h23",
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	});
	const m: Record<string, number> = {};
	for (const p of fmt.formatToParts(date)) if (p.type !== "literal") m[p.type] = Number(p.value);
	const g = (k: string): number => m[k] ?? 0;
	return {
		y: g("year"),
		mo: g("month"),
		d: g("day"),
		h: g("hour") === 24 ? 0 : g("hour"),
		mi: g("minute"),
		s: g("second"),
	};
}

/** Offset (ms) of tz from UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
	const p = wallParts(date, tz);
	const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
	return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant at which the wall clock in tz reads y-mo-d h:mi. */
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
	const guess = Date.UTC(y, mo - 1, d, h, mi);
	let t = guess - tzOffsetMs(new Date(guess), tz);
	t = guess - tzOffsetMs(new Date(t), tz);
	return new Date(t);
}

/** Next fire time strictly after `after`. Pure. */
export function nextFire(cfg: ScheduleConfig, after: Date): Date {
	if (cfg.mode === "every") {
		const step = Math.max(1, cfg.everyMin ?? 60) * 60_000;
		const base = Math.floor(after.getTime() / 60_000) * 60_000;
		return new Date(base + step);
	}
	const tz = resolveTz(cfg.timeZone);
	const times = (cfg.times && cfg.times.length > 0 ? cfg.times : ["09:00"]).map((t) => {
		const [h, m] = t.split(":").map(Number);
		return { h: h ?? 0, m: m ?? 0 };
	});
	times.sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
	const days = cfg.mode === "weekly" && cfg.days && cfg.days.length > 0 ? cfg.days : [0, 1, 2, 3, 4, 5, 6];
	const start = wallParts(after, tz);
	for (let i = 0; i <= 8; i++) {
		const day = new Date(Date.UTC(start.y, start.mo - 1, start.d) + i * DAY_MS);
		if (!days.includes(day.getUTCDay())) continue;
		for (const t of times) {
			const c = zonedToDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), t.h, t.m, tz);
			if (c.getTime() > after.getTime()) return c;
		}
	}
	return new Date(after.getTime() + DAY_MS);
}

function buildEvent(ctx: SourceCtx<ScheduleConfig>, fire: Date): NewEvent {
	const tz = resolveTz(ctx.config.timeZone);
	let local: string;
	try {
		local = fire.toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
	} catch {
		local = fire.toISOString();
	}
	return {
		title: `Scheduled: ${ctx.watcher.label}`,
		body: `${ctx.watcher.label} (${local})`,
		facts: { firedAt: fire.toISOString(), timeZone: tz },
		dedupeKey: fire.toISOString(),
		importanceHint: "normal",
		occurredAt: ctx.deps.now().toISOString(),
	};
}

export const scheduleSource: WatcherSource<ScheduleConfig> = {
	type: "schedule",
	label: "Schedule",
	configSchema: scheduleConfigSchema,
	defaultIntervalSec: 30,
	minIntervalSec: 15,
	async poll(ctx, cursor) {
		const now = ctx.deps.now();
		const next = cursor ? new Date(cursor) : null;
		if (!next || Number.isNaN(next.getTime())) {
			return { events: [], cursor: nextFire(ctx.config, now).toISOString() };
		}
		if (now.getTime() < next.getTime()) return { events: [], cursor: next.toISOString() };
		const events: NewEvent[] = [];
		if (now.getTime() - next.getTime() <= MAX_LATE_MS) events.push(buildEvent(ctx, next));
		return { events, cursor: nextFire(ctx.config, now).toISOString() };
	},
	async test(ctx) {
		const next = nextFire(ctx.config, ctx.deps.now());
		return {
			ok: true,
			message: `Next fire: ${next.toISOString()}`,
			sample: [buildEvent(ctx, next)],
		};
	},
};
