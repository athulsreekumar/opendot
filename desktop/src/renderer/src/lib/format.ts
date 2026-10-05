import { format, isThisWeek, isToday, isYesterday } from "date-fns";

/** List-pane time: "10:42", "Yesterday", "Monday", "12/09/2026". */
export function listTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
	if (isToday(d)) return format(d, "HH:mm");
	if (isYesterday(d)) return "Yesterday";
	if (isThisWeek(d)) return format(d, "EEEE");
	return format(d, "dd/MM/yyyy");
}

export function bubbleTime(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "" : format(d, "HH:mm");
}

export function dayLabel(iso: string): string {
	const d = new Date(iso);
	if (isToday(d)) return "Today";
	if (isYesterday(d)) return "Yesterday";
	if (isThisWeek(d)) return format(d, "EEEE");
	return format(d, "d MMM yyyy");
}

export function relativeTime(iso?: string): string {
	if (!iso) return "never";
	const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 0) return `in ${humanDur(-s)}`;
	if (s < 5) return "just now";
	return `${humanDur(s)} ago`;
}

export function humanDur(s: number): string {
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.round(s / 60)} min`;
	if (s < 86400) return `${Math.round(s / 3600)} h`;
	return `${Math.round(s / 86400)} d`;
}
