// Pure scheduling for the daily briefing. All times are the user's local wall clock.
// Day arithmetic goes through the Date constructor (never "+ 24 h"), so DST changes cannot shift or skip a day.
import type { BriefingSettings } from "../../shared/types";

/** After this local time of day a missed briefing is not run any more (it would no longer be a morning briefing). */
export const CATCH_UP_UNTIL_MINUTES = 18 * 60;
/** A run that starts within this long after its scheduled time counts as on time, even after 18:00. */
export const ON_TIME_GRACE_MS = 15 * 60_000;

export type Cadence = Pick<BriefingSettings, "enabled" | "time" | "days">;

export function dateKey(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseTime(t: string): { h: number; m: number } {
	const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
	const h = m ? Number(m[1]) : 8;
	const min = m ? Number(m[2]) : 0;
	return h > 23 || min > 59 ? { h: 8, m: 0 } : { h, m: min };
}

/** Monday to Friday, or every day. */
export function isRunDay(d: Date, days: BriefingSettings["days"]): boolean {
	if (days === "daily") return true;
	const dow = d.getDay();
	return dow >= 1 && dow <= 5;
}

/** The scheduled instant on the local calendar day of `day`. A time skipped by a DST jump runs just after it. */
export function scheduledAt(day: Date, time: string): Date {
	const { h, m } = parseTime(time);
	return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0, 0);
}

function minutesOfDay(d: Date): number {
	return d.getHours() * 60 + d.getMinutes();
}

export type Decision =
	| { kind: "idle" }
	| { kind: "wait"; at: Date }
	| { kind: "run"; scheduledFor: Date; catchUp: boolean };

/**
 * What to do at `now`. Runs at most once per local day (`lastRunDate`), on the chosen days, at the chosen time.
 * If the app was not running at that time, it runs once when it next runs the same day before 18:00.
 */
export function decide(now: Date, cfg: Cadence, lastRunDate: string | undefined): Decision {
	if (!cfg.enabled) return { kind: "idle" };
	if (isRunDay(now, cfg.days) && lastRunDate !== dateKey(now)) {
		const at = scheduledAt(now, cfg.time);
		if (now.getTime() < at.getTime()) return { kind: "wait", at };
		const late = now.getTime() - at.getTime();
		if (late <= ON_TIME_GRACE_MS) return { kind: "run", scheduledFor: at, catchUp: false };
		if (minutesOfDay(now) < CATCH_UP_UNTIL_MINUTES) return { kind: "run", scheduledFor: at, catchUp: true };
	}
	const next = nextRun(now, cfg, lastRunDate);
	return next ? { kind: "wait", at: next } : { kind: "idle" };
}

/** The next scheduled instant strictly after `now` that has not already been served. */
export function nextRun(now: Date, cfg: Cadence, lastRunDate: string | undefined): Date | undefined {
	if (!cfg.enabled) return undefined;
	for (let i = 0; i < 9; i++) {
		const day = addDays(now, i);
		if (!isRunDay(day, cfg.days)) continue;
		if (i === 0 && lastRunDate === dateKey(day)) continue;
		const at = scheduledAt(day, cfg.time);
		if (at.getTime() > now.getTime()) return at;
	}
	return undefined;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Briefing · Tue 7 Oct" */
export function briefingLabel(d: Date): string {
	return `Briefing · ${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
