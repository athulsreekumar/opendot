import type { LinkSchedule } from "../../shared/types";

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseHm(v: string): number {
	const [h, m] = v.split(":");
	return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function zonedDayAndMinutes(timeZone: string, now: Date): { day: number; minutes: number } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	let weekday = "Sun";
	let hour = 0;
	let minute = 0;
	for (const p of parts) {
		if (p.type === "weekday") weekday = p.value;
		else if (p.type === "hour") hour = Number(p.value) % 24;
		else if (p.type === "minute") minute = Number(p.value);
	}
	return { day: DAY_INDEX[weekday] ?? 0, minutes: hour * 60 + minute };
}

export function isOpen(s: LinkSchedule, now: Date): boolean {
	const { day, minutes } = zonedDayAndMinutes(s.timeZone, now);
	const start = parseHm(s.start);
	const end = parseHm(s.end);
	const today = s.days.includes(day);
	if (start === end) return today;
	if (end > start) return today && minutes >= start && minutes < end;
	const prev = s.days.includes((day + 6) % 7);
	return (today && minutes >= start) || (prev && minutes < end);
}

export function describeSchedule(s: LinkSchedule): string {
	const days = [...new Set(s.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
	let dayText: string;
	if (days.length === 7) dayText = "Every day";
	else if (days.length === 0) dayText = "No days";
	else {
		const runs: string[] = [];
		let i = 0;
		while (i < days.length) {
			let j = i;
			while (j + 1 < days.length && days[j + 1] === (days[j] as number) + 1) j++;
			const a = DAY_NAMES[days[i] as number];
			const b = DAY_NAMES[days[j] as number];
			if (j === i) runs.push(a as string);
			else if (j === i + 1) runs.push(`${a}, ${b}`);
			else runs.push(`${a}–${b}`);
			i = j + 1;
		}
		dayText = runs.join(", ");
	}
	return `${dayText} ${s.start}–${s.end} (${s.timeZone})`;
}
