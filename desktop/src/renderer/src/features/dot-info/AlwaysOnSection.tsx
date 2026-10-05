import type { Dot, LinkSchedule } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { Input, SegmentedControl, Select, Slider, Switch, TextArea, toast } from "@/design-system/components";
import { WatcherList } from "@/features/watchers/WatcherList";
import { DayPicker, localTimeZone } from "@/features/watchers/watcher-forms";
import { api, errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";
import { Field, SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

export const BRIEFING_LABEL = "Daily briefing";
export const BRIEFING_INSTRUCTIONS =
	"Call get_dot_updates for the last 24 h, then ask_dots only where you need detail. Post a briefing: urgent first, then today's schedule, then everything else in one line each.";

const BATCH_OPTIONS = [
	{ value: "0", label: "Instant" },
	{ value: "10", label: "10 seconds" },
	{ value: "60", label: "1 minute" },
	{ value: "300", label: "5 minutes" },
];

function useEventsToday(dotId: string): number | undefined {
	const [n, setN] = useState<number>();
	useEffect(() => {
		let alive = true;
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		void Promise.resolve()
			.then(() => api.events.list(dotId as Dot["id"], { limit: 200 }))
			.then((list) => alive && setN(list.filter((e) => new Date(e.occurredAt) >= start).length))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [dotId]);
	return n;
}

function StatusLine({ dot }: { dot: Dot }) {
	const health = useRuntime((s) => s.health[dot.id]);
	const events = useEventsToday(dot.id);
	if (!dot.alwaysOn.enabled)
		return <p className="text-sm text-fg-3">Off. Turn it on to keep this Dot working in the background.</p>;
	const next = health?.watchers
		.map((w) => w.nextRunAt)
		.filter((x): x is string => Boolean(x))
		.sort()[0];
	const parts = [
		health?.state ?? "starting",
		next ? `next check ${relativeTime(next)}` : undefined,
		events !== undefined ? `${events} event${events === 1 ? "" : "s"} today` : undefined,
		health ? `$${health.costTodayUsd.toFixed(2)} today` : undefined,
	].filter(Boolean);
	return <p className="text-sm text-fg-2">{parts.join(" · ")}</p>;
}

export function QuietHours({
	value,
	onChange,
}: {
	value?: LinkSchedule;
	onChange: (v: LinkSchedule | undefined) => void;
}) {
	const base: LinkSchedule = value ?? {
		timeZone: localTimeZone(),
		days: [0, 1, 2, 3, 4, 5, 6],
		start: "22:00",
		end: "07:00",
	};
	return (
		<div className="flex flex-col gap-2">
			<Switch label="Quiet hours" checked={Boolean(value)} onCheckedChange={(on) => onChange(on ? base : undefined)} />
			{value && (
				<div className="flex flex-col gap-2 pl-10">
					<DayPicker days={value.days} onChange={(days) => onChange({ ...value, days })} />
					<div className="flex items-center gap-2 text-sm text-fg-2">
						<Input
							aria-label="Quiet hours start"
							type="time"
							className="w-28"
							value={value.start}
							onChange={(e) => onChange({ ...value, start: e.target.value })}
						/>
						to
						<Input
							aria-label="Quiet hours end"
							type="time"
							className="w-28"
							value={value.end}
							onChange={(e) => onChange({ ...value, end: e.target.value })}
						/>
					</div>
					<p className="text-xs text-fg-3">Only urgent things get through during quiet hours.</p>
				</div>
			)}
		</div>
	);
}

function Briefing({ dot }: { dot: Dot }) {
	const { saveAlwaysOn, saved } = useDotSaver(dot.id);
	const [watcherId, setWatcherId] = useState<string>();
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void Promise.resolve()
			.then(() => api.watchers.list(dot.id))
			.then((l) => setWatcherId(l.find((w) => w.label === BRIEFING_LABEL)?.id))
			.catch(() => undefined);
	}, [dot.id]);

	const toggle = async (on: boolean) => {
		setBusy(true);
		try {
			if (on) {
				const w = await api.watchers.create({
					dotId: dot.id,
					type: "schedule",
					label: BRIEFING_LABEL,
					config: { mode: "weekly", times: ["08:30"], days: [1, 2, 3, 4, 5], timeZone: localTimeZone() },
				});
				setWatcherId(w.id);
				const updated = await api.runtime.setAlwaysOn(dot.id, true);
				useDots.getState().upsert(updated);
				saveAlwaysOn({ enabled: true, standingInstructions: BRIEFING_INSTRUCTIONS });
			} else {
				const all = await api.watchers.list(dot.id);
				await Promise.all(all.filter((w) => w.label === BRIEFING_LABEL).map((w) => api.watchers.remove(w.id)));
				setWatcherId(undefined);
				const updated = await api.runtime.setAlwaysOn(dot.id, false);
				useDots.getState().upsert(updated);
				if (updated.alwaysOn.standingInstructions === BRIEFING_INSTRUCTIONS) saveAlwaysOn({ standingInstructions: "" });
			}
		} catch (e) {
			toast({ title: "Couldn't change the briefing", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<SectionCard title="Always on" description="Briefings" saved={saved} testId="section-always-on">
			<Switch
				label={BRIEFING_LABEL}
				description="Every weekday at 08:30, SuperDot posts what's urgent, what's on today and a line for everything else."
				checked={Boolean(watcherId)}
				disabled={busy}
				onCheckedChange={(on) => void toggle(on)}
			/>
			<StatusLine dot={dot} />
		</SectionCard>
	);
}

export function AlwaysOnSection({ dot }: { dot: Dot }) {
	const { saveAlwaysOn, saved } = useDotSaver(dot.id);
	const [busy, setBusy] = useState(false);
	const a = dot.alwaysOn;
	const [cost, setCost] = useState(String(a.budget.maxCostUsdPerDay));

	const setMaster = useCallback(
		async (on: boolean) => {
			setBusy(true);
			try {
				const updated = await api.runtime.setAlwaysOn(dot.id, on);
				useDots.getState().upsert(updated);
			} catch (e) {
				toast({ title: "Couldn't change always on", description: errorText(e), variant: "error" });
			} finally {
				setBusy(false);
			}
		},
		[dot.id],
	);

	if (dot.kind === "super") return <Briefing dot={dot} />;

	return (
		<SectionCard title="Always on" saved={saved} testId="section-always-on">
			<div className="flex flex-col gap-1">
				<Switch
					label="Always on — keep working in the background"
					checked={a.enabled}
					disabled={busy}
					onCheckedChange={(on) => void setMaster(on)}
				/>
				<div className="pl-10">
					<StatusLine dot={dot} />
				</div>
			</div>

			<Field label="Standing instructions" hint="What should this Dot look out for, and what counts as important?">
				<TextArea
					aria-label="Standing instructions"
					autoGrow
					minRows={2}
					maxRows={8}
					maxLength={1000}
					showCount
					value={a.standingInstructions}
					placeholder="Tell me about anything that likely needs my attention."
					onChange={(e) => saveAlwaysOn({ standingInstructions: e.target.value })}
				/>
			</Field>

			<Field label="Notify me">
				<SegmentedControl
					aria-label="Notify me"
					value={a.notify}
					options={[
						{ value: "urgent", label: "Urgent only" },
						{ value: "updates", label: "Updates" },
						{ value: "none", label: "Never" },
					]}
					onValueChange={(v) => saveAlwaysOn({ notify: v as Dot["alwaysOn"]["notify"] })}
				/>
			</Field>

			<QuietHours value={a.quietHours} onChange={(quietHours) => saveAlwaysOn({ quietHours })} />

			<Field label="Group events for" hint="Wait this long to bundle events into one message.">
				<Select
					aria-label="Batch window"
					value={String(a.batchWindowSec)}
					groups={[{ items: BATCH_OPTIONS }]}
					onValueChange={(v) => saveAlwaysOn({ batchWindowSec: Number(v) })}
				/>
			</Field>

			<Field label={`Budget: up to ${a.budget.maxTurnsPerHour} replies per hour`}>
				<Slider
					aria-label="Turns per hour"
					min={1}
					max={120}
					step={1}
					value={a.budget.maxTurnsPerHour}
					onValueChange={(n) => saveAlwaysOn({ budget: { ...a.budget, maxTurnsPerHour: n } })}
					leftLabel="1"
					rightLabel="120"
				/>
			</Field>
			<Field label="Daily spend limit ($)">
				<Input
					aria-label="Daily spend limit"
					type="number"
					min={0}
					step={0.5}
					className="w-32"
					value={cost}
					onChange={(e) => {
						setCost(e.target.value);
						const n = Number(e.target.value);
						if (e.target.value !== "" && Number.isFinite(n) && n >= 0)
							saveAlwaysOn({ budget: { ...a.budget, maxCostUsdPerDay: n } });
					}}
				/>
			</Field>

			<WatcherList dotId={dot.id} />
		</SectionCard>
	);
}
