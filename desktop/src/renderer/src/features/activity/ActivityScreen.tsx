import type { Dot, DotEventView, DotHealth, WatcherType } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { navigate } from "@/app/router";
import { Avatar, Badge, StatusPill, Switch, toast } from "@/design-system/components";
import {
	IconCalendar,
	IconClock,
	IconFolder,
	IconGlobe,
	IconMail,
	IconRss,
	IconWebhook,
	IconZap,
} from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";
import { useSettings } from "@/stores/settings";

function sourceIcon(type: WatcherType) {
	if (type === "schedule") return IconClock;
	if (type === "folder" || type === "onedrive" || type === "google-drive") return IconFolder;
	if (type === "url") return IconGlobe;
	if (type === "rss") return IconRss;
	if (type === "local-webhook") return IconWebhook;
	if (type === "gmail" || type === "outlook-mail") return IconMail;
	if (type.includes("calendar")) return IconCalendar;
	return IconZap;
}

interface FeedItem extends DotEventView {
	dotId: string;
}

const EVENT_STATUS: Record<
	DotEventView["status"],
	{ label: string; variant: "muted" | "success" | "warning" | "info" }
> = {
	queued: { label: "Queued", variant: "info" },
	delivered: { label: "Delivered", variant: "info" },
	handled: { label: "Handled", variant: "success" },
	"dropped-budget": { label: "Over budget", variant: "warning" },
	"dropped-duplicate": { label: "Duplicate", variant: "muted" },
};

export function ActivityScreen() {
	const dots = useDots((s) => s.dots);
	const health = useRuntime((s) => s.health);
	const settings = useSettings((s) => s.settings);
	const [feed, setFeed] = useState<FeedItem[]>([]);
	const [pausing, setPausing] = useState(false);

	useEffect(() => {
		const load = () =>
			void useRuntime
				.getState()
				.loadHealth()
				.catch(() => {});
		load();
		const t = setInterval(load, 5000);
		return () => clearInterval(t);
	}, []);

	const alwaysOnIds = useMemo(
		() =>
			dots
				.filter((d) => d.alwaysOn.enabled)
				.map((d) => d.id)
				.join(","),
		[dots],
	);

	useEffect(() => {
		const ids = alwaysOnIds ? alwaysOnIds.split(",") : [];
		let cancelled = false;
		const load = async () => {
			const lists = await Promise.all(
				ids.map((id) =>
					api.events
						.list(id as Dot["id"], { limit: 20 })
						.then((es) => es.map((e) => ({ ...e, dotId: id })))
						.catch(() => [] as FeedItem[]),
				),
			);
			if (cancelled) return;
			setFeed(
				lists
					.flat()
					.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
					.slice(0, 50),
			);
		};
		void load();
		const t = setInterval(load, 15000);
		return () => {
			cancelled = true;
			clearInterval(t);
		};
	}, [alwaysOnIds]);

	const paused = settings?.background.paused ?? false;
	const setPaused = async (on: boolean) => {
		if (!settings) return;
		setPausing(true);
		try {
			await api.runtime.pauseAll(on);
			await useSettings.getState().update({ background: { ...settings.background, paused: on } });
		} catch (e) {
			toast({ title: "Couldn't change that", description: errorText(e), variant: "error" });
		} finally {
			setPausing(false);
		}
	};

	const visibleDots = dots.filter((d) => !d.archived);
	const byId = (id: string) => dots.find((d) => d.id === id);

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-[1100px] p-8">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 className="text-3xl font-semibold text-fg">Activity</h1>
						<p className="mt-1 text-md text-fg-2">See what your Dots are doing in the background.</p>
					</div>
					<Switch
						label="Pause all"
						aria-label="Pause all"
						checked={paused}
						disabled={!settings || pausing}
						onCheckedChange={(on) => void setPaused(on)}
					/>
				</div>

				<div className="overflow-x-auto rounded-lg border border-border-subtle bg-elevated">
					<table className="w-full text-left text-sm">
						<thead className="bg-sunken text-xs text-fg-3">
							<tr>
								{["Dot", "State", "Always on", "Watchers", "Queued", "Turns/h", "Cost today", "Last error"].map((h) => (
									<th key={h} className="px-3 py-2 font-medium">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{visibleDots.map((d) => (
								<HealthRow key={d.id} dot={d} health={health[d.id]} />
							))}
							{visibleDots.length === 0 && (
								<tr>
									<td colSpan={8} className="px-3 py-8 text-center text-fg-3">
										No Dots yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				<section className="mt-8 flex flex-col gap-2">
					<h2 className="text-lg font-semibold text-fg">Recent events</h2>
					{feed.length === 0 ? (
						<p className="text-sm text-fg-3">Events from always-on Dots will show up here.</p>
					) : (
						<ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-elevated">
							{feed.map((e) => {
								const d = byId(e.dotId);
								const Icon = sourceIcon(e.type);
								return (
									<li key={`${e.dotId}-${e.id}`} className="flex items-center gap-3 px-3 py-2">
										<Icon size={16} className="shrink-0 text-fg-3" aria-label={e.type} />
										{d && (
											<Avatar
												size="xs"
												icon={d.appearance.icon}
												color={d.appearance.color}
												name={d.name}
												mark={d.kind === "super"}
											/>
										)}
										<span className="shrink-0 text-sm font-medium text-fg">{d?.name ?? "Dot"}</span>
										<span className="min-w-0 flex-1 truncate text-sm text-fg-2">{e.title}</span>
										<Badge variant={EVENT_STATUS[e.status].variant}>{EVENT_STATUS[e.status].label}</Badge>
										<span className="w-16 shrink-0 text-right text-xs text-fg-3">{relativeTime(e.occurredAt)}</span>
									</li>
								);
							})}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}

function HealthRow({ dot, health }: { dot: Dot; health?: DotHealth }) {
	const open = () => navigate(`#/chats/${dot.id}`);
	return (
		<tr
			tabIndex={0}
			onClick={open}
			onKeyDown={(e) => {
				if (e.key === "Enter") open();
			}}
			className="cursor-pointer border-t border-border-subtle hover:bg-hover"
		>
			<td className="px-3 py-2">
				<span className="flex items-center gap-2 text-fg">
					<Avatar
						size="xs"
						icon={dot.appearance.icon}
						color={dot.appearance.color}
						name={dot.name}
						mark={dot.kind === "super"}
					/>
					{dot.name}
				</span>
			</td>
			<td className="px-3 py-2">
				<StatusPill state={health?.state ?? "off"} />
			</td>
			<td className="px-3 py-2 text-fg-2">{(health?.alwaysOn ?? dot.alwaysOn.enabled) ? "On" : "Off"}</td>
			<td className="px-3 py-2 text-fg-2">
				{health && health.watchers.length > 0 ? (
					<span title={health.watchers.map((w) => `${w.label}: ${w.state}`).join("\n")}>
						{health.watchers.length} ({[...new Set(health.watchers.map((w) => w.state))].join(", ")})
					</span>
				) : (
					"0"
				)}
			</td>
			<td className="px-3 py-2 text-fg-2">{health?.queuedEvents ?? 0}</td>
			<td className="px-3 py-2 text-fg-2">{health?.turnsLastHour ?? 0}</td>
			<td className="px-3 py-2 text-fg-2">${(health?.costTodayUsd ?? 0).toFixed(2)}</td>
			<td className="max-w-[220px] truncate px-3 py-2 text-danger">{health?.lastError ?? ""}</td>
		</tr>
	);
}
