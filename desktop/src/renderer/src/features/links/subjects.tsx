import type { Dot, DotLink, LinkSchedule, LinkSubject } from "@shared/types";
import { Avatar } from "@/design-system/components";

export function subjectToValue(s: LinkSubject): string {
	switch (s.kind) {
		case "dot":
			return `dot:${s.dotId}`;
		case "role":
			return `role:${s.role}`;
		case "super":
			return "super";
		case "any":
			return "any";
	}
}

export function valueToSubject(v: string): LinkSubject {
	if (v.startsWith("dot:")) return { kind: "dot", dotId: v.slice(4) as `dot_${string}` };
	if (v.startsWith("role:")) return { kind: "role", role: v.slice(5) };
	if (v === "super") return { kind: "super" };
	return { kind: "any" };
}

export function SubjectChip({ subject, dots }: { subject: LinkSubject; dots: Dot[] }) {
	if (subject.kind === "dot") {
		const d = dots.find((x) => x.id === subject.dotId);
		if (!d) return <span className="text-sm text-fg-3">Removed Dot</span>;
		return (
			<span className="inline-flex items-center gap-1.5 text-sm text-fg">
				<Avatar size="xs" icon={d.appearance.icon} color={d.appearance.color} name={d.name} mark={d.kind === "super"} />
				{d.name}
			</span>
		);
	}
	const label = subject.kind === "role" ? `#${subject.role}` : subject.kind === "super" ? "SuperDot" : "Any Dot";
	return (
		<span className="inline-flex h-6 items-center rounded-full bg-active px-2.5 text-xs font-medium text-fg-2">
			{label}
		</span>
	);
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hour(t: string): string {
	const [h = "0", m = "00"] = t.split(":");
	const hh = String(Number.parseInt(h, 10));
	return m === "00" ? hh : `${hh}:${m}`;
}

export function summarizeSchedule(s?: LinkSchedule): string {
	if (!s) return "Any time";
	const days = DAY_ORDER.filter((d) => s.days.includes(d));
	let dayText: string;
	if (days.length === 7) dayText = "Every day";
	else if (days.length === 0) dayText = "No days";
	else {
		const idx = days.map((d) => DAY_ORDER.indexOf(d));
		const consecutive = idx.every((v, i) => i === 0 || v === (idx[i - 1] ?? 0) + 1);
		const first = days[0] ?? 0;
		const last = days[days.length - 1] ?? 0;
		dayText =
			consecutive && days.length >= 3
				? `${DAY_NAMES[first]}–${DAY_NAMES[last]}`
				: days.map((d) => DAY_NAMES[d]).join(", ");
	}
	return `${dayText} ${hour(s.start)}–${hour(s.end)}`;
}

export function ruleSort(a: DotLink, b: DotLink): number {
	return a.createdAt.localeCompare(b.createdAt);
}
