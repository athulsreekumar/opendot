import type { Watcher, WatcherConfig, WatcherType } from "@shared/types";
import type { ReactNode } from "react";
import { cn } from "@/design-system/cn";
import { Button, Input, Select, Switch } from "@/design-system/components";
import {
	IconCalendar,
	IconClock,
	IconCloud,
	IconFolder,
	IconGlobe,
	IconMail,
	IconRss,
	IconTool,
	IconWebhook,
} from "@/design-system/icons";
import { Field } from "@/features/dot-info/ui";
import { api } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";

export function watcherIcon(type: WatcherType, size = 16): ReactNode {
	switch (type) {
		case "schedule":
			return <IconClock size={size} />;
		case "folder":
			return <IconFolder size={size} />;
		case "url":
			return <IconGlobe size={size} />;
		case "rss":
			return <IconRss size={size} />;
		case "local-webhook":
			return <IconWebhook size={size} />;
		case "gmail":
		case "outlook-mail":
			return <IconMail size={size} />;
		case "google-calendar":
		case "outlook-calendar":
		case "mac-calendar":
			return <IconCalendar size={size} />;
		case "google-drive":
		case "onedrive":
			return <IconCloud size={size} />;
		default:
			return <IconTool size={size} />;
	}
}

export const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function localTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
	} catch {
		return "local";
	}
}

export function defaultConfig(type: WatcherType): WatcherConfig {
	switch (type) {
		case "schedule":
			return { mode: "daily", times: ["09:00"], days: [1, 2, 3, 4, 5], timeZone: localTimeZone() };
		case "folder":
			return { path: "", recursive: false, events: ["created"] };
		case "url":
		case "rss":
			return { url: "" };
		case "gmail":
			return { query: "", labelIds: ["INBOX"] };
		case "google-calendar":
			return { calendarId: "primary", remindMinutes: [15] };
		case "outlook-calendar":
		case "mac-calendar":
			return { remindMinutes: [15] };
		case "google-drive":
			return { folderId: "" };
		case "onedrive":
			return { path: "" };
		case "outlook-mail":
			return { folder: "inbox" };
		case "teams-chat":
			return { chatIds: [] };
		case "mcp-resource":
			return { connectionId: "", uri: "" };
		case "mcp-poll":
			return { connectionId: "", tool: "", args: "{}" };
		case "mac-reminders":
			return { list: "" };
		default:
			return {};
	}
}

export interface FormExtra {
	readOnlyConfirmed: boolean;
}

/** Returns an error message when the config can't be saved yet, otherwise undefined. */
export function validateConfig(type: WatcherType, c: WatcherConfig, extra: FormExtra): string | undefined {
	const str = (k: string) => (typeof c[k] === "string" ? (c[k] as string).trim() : "");
	switch (type) {
		case "schedule": {
			if (c.mode === "every") {
				const n = Number(c.everyMin);
				return n >= 5 && n <= 1440 ? undefined : "Choose between 5 and 1440 minutes.";
			}
			const times = Array.isArray(c.times) ? (c.times as string[]) : [];
			if (times.length === 0 || times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
				return "Add at least one time like 08:30.";
			if (c.mode === "weekly" && (!Array.isArray(c.days) || c.days.length === 0)) return "Pick at least one day.";
			return undefined;
		}
		case "folder":
			if (!str("path")) return "Choose a folder.";
			return Array.isArray(c.events) && c.events.length > 0 ? undefined : "Pick at least one kind of change.";
		case "url":
		case "rss":
			return /^https:\/\/\S+$/i.test(str("url")) ? undefined : "Enter a link that starts with https://";
		case "teams-chat":
			return Array.isArray(c.chatIds) && c.chatIds.length > 0 ? undefined : "Add at least one chat id.";
		case "mcp-resource":
			return str("connectionId") && str("uri") ? undefined : "Pick a connection and enter the resource address.";
		case "mcp-poll": {
			if (!str("connectionId") || !str("tool")) return "Pick a connection and a tool.";
			try {
				JSON.parse(str("args") || "{}");
			} catch {
				return "Arguments must be valid JSON.";
			}
			return extra.readOnlyConfirmed ? undefined : "Confirm that this tool only reads data.";
		}
		default:
			return undefined;
	}
}

function csv(v: unknown): string {
	return Array.isArray(v) ? v.join(", ") : "";
}
function splitCsv(s: string): string[] {
	return s
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => onChange(!on)}
			className={cn(
				"h-7 rounded-full border px-3 text-sm transition-colors",
				on ? "border-accent bg-accent-subtle text-accent" : "border-border-subtle text-fg-2 hover:bg-hover",
			)}
		>
			{label}
		</button>
	);
}

export function DayPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
	return (
		<fieldset className="flex gap-1" aria-label="Days">
			{WEEKDAYS.map((d, i) => {
				const on = days.includes(i);
				return (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-day list
						key={i}
						type="button"
						aria-pressed={on}
						aria-label={WEEKDAY_NAMES[i]}
						onClick={() => onChange(on ? days.filter((x) => x !== i) : [...days, i].sort())}
						className={cn(
							"h-7 w-7 rounded-full border text-xs transition-colors",
							on ? "border-accent bg-accent-subtle text-accent" : "border-border-subtle text-fg-2 hover:bg-hover",
						)}
					>
						{d}
					</button>
				);
			})}
		</fieldset>
	);
}

/** Per-type config form generated from a small field map (spec 12 §5). */
export function WatcherForm({
	type,
	config,
	onChange,
	extra,
	onExtra,
}: {
	type: WatcherType;
	config: WatcherConfig;
	onChange: (c: WatcherConfig) => void;
	extra: FormExtra;
	onExtra: (e: FormExtra) => void;
}) {
	const connections = useRuntime((s) => s.connections);
	const status = useRuntime((s) => s.connectionStatus);
	const set = (patch: WatcherConfig) => onChange({ ...config, ...patch });
	const text = (k: string) => (typeof config[k] === "string" ? (config[k] as string) : "");

	switch (type) {
		case "schedule": {
			const mode = String(config.mode ?? "daily");
			const times = Array.isArray(config.times) ? (config.times as string[]) : [];
			return (
				<div className="flex flex-col gap-3">
					<Field label="How often">
						<Select
							aria-label="Schedule mode"
							value={mode}
							onValueChange={(m) => set({ mode: m, ...(m === "every" && !config.everyMin ? { everyMin: 60 } : {}) })}
							groups={[
								{
									items: [
										{ value: "every", label: "Every few minutes" },
										{ value: "daily", label: "Every day" },
										{ value: "weekly", label: "On certain days" },
									],
								},
							]}
						/>
					</Field>
					{mode === "every" ? (
						<Field label="Every (minutes)">
							<Input
								aria-label="Every minutes"
								type="number"
								min={5}
								max={1440}
								value={String(config.everyMin ?? 60)}
								onChange={(e) => set({ everyMin: Number(e.target.value) })}
							/>
						</Field>
					) : (
						<>
							<Field label="At these times" hint="24-hour times separated by commas, e.g. 08:30, 17:00">
								<Input
									aria-label="Times"
									value={times.join(", ")}
									onChange={(e) => set({ times: splitCsv(e.target.value) })}
								/>
							</Field>
							{mode === "weekly" && (
								<Field label="On these days">
									<DayPicker days={(config.days as number[] | undefined) ?? []} onChange={(days) => set({ days })} />
								</Field>
							)}
						</>
					)}
				</div>
			);
		}
		case "folder": {
			const events = Array.isArray(config.events) ? (config.events as string[]) : [];
			return (
				<div className="flex flex-col gap-3">
					<Field label="Folder">
						<div className="flex gap-2">
							<Input
								aria-label="Folder path"
								value={text("path")}
								onChange={(e) => set({ path: e.target.value })}
								placeholder="/Users/you/Invoices"
							/>
							<Button
								variant="secondary"
								onClick={async () => {
									const p = await api.app.pickFolder({ title: "Choose a folder to watch" });
									if (p) set({ path: p });
								}}
							>
								Choose…
							</Button>
						</div>
					</Field>
					<Switch
						label="Include subfolders"
						checked={Boolean(config.recursive)}
						onCheckedChange={(recursive) => set({ recursive })}
					/>
					<Field label="Tell me when files are">
						<div className="flex gap-1.5">
							{(["created", "modified", "deleted"] as const).map((ev) => (
								<Toggle
									key={ev}
									label={ev[0]?.toUpperCase() + ev.slice(1)}
									on={events.includes(ev)}
									onChange={(on) => set({ events: on ? [...events, ev] : events.filter((x) => x !== ev) })}
								/>
							))}
						</div>
					</Field>
				</div>
			);
		}
		case "url":
		case "rss":
			return (
				<Field label={type === "rss" ? "Feed address" : "Page address"}>
					<Input
						aria-label="Address"
						value={text("url")}
						placeholder="https://"
						onChange={(e) => set({ url: e.target.value })}
					/>
				</Field>
			);
		case "local-webhook":
			return (
				<p className="text-sm text-fg-2">
					After saving you'll get a private address and a ready-to-paste curl command.
				</p>
			);
		case "gmail":
			return (
				<div className="flex flex-col gap-3">
					<Field label="Search filter (optional)" hint='Gmail search syntax, e.g. "is:important -category:promotions"'>
						<Input aria-label="Gmail query" value={text("query")} onChange={(e) => set({ query: e.target.value })} />
					</Field>
					<Field label="Labels" hint="Separate with commas. Default is INBOX.">
						<Input
							aria-label="Label ids"
							value={csv(config.labelIds)}
							onChange={(e) => set({ labelIds: splitCsv(e.target.value) })}
						/>
					</Field>
				</div>
			);
		case "google-calendar":
		case "outlook-calendar":
		case "mac-calendar":
			return (
				<Field label="Remind me (minutes before)" hint="Separate with commas, e.g. 15, 60">
					<Input
						aria-label="Remind minutes"
						value={csv(config.remindMinutes)}
						onChange={(e) =>
							set({
								remindMinutes: splitCsv(e.target.value)
									.map(Number)
									.filter((n) => Number.isFinite(n) && n >= 0),
							})
						}
					/>
				</Field>
			);
		case "google-drive":
			return (
				<Field label="Folder id (optional)" hint="Leave empty to watch all of My Drive.">
					<Input
						aria-label="Drive folder id"
						value={text("folderId")}
						onChange={(e) => set({ folderId: e.target.value })}
					/>
				</Field>
			);
		case "onedrive":
			return (
				<Field label="Folder path (optional)" hint="Leave empty to watch all of OneDrive.">
					<Input aria-label="OneDrive path" value={text("path")} onChange={(e) => set({ path: e.target.value })} />
				</Field>
			);
		case "outlook-mail":
			return <p className="text-sm text-fg-2">Watches your Outlook inbox for new mail. Nothing to configure.</p>;
		case "teams-chat":
			return (
				<Field label="Chat ids" hint="Separate with commas.">
					<Input
						aria-label="Chat ids"
						value={csv(config.chatIds)}
						onChange={(e) => set({ chatIds: splitCsv(e.target.value) })}
					/>
				</Field>
			);
		case "mac-reminders":
			return (
				<Field label="Reminders list (optional)">
					<Input aria-label="Reminders list" value={text("list")} onChange={(e) => set({ list: e.target.value })} />
				</Field>
			);
		case "mcp-resource":
		case "mcp-poll": {
			const mcp = connections.filter((c) => c.type === "mcp-stdio" || c.type === "mcp-http");
			const connId = text("connectionId");
			const tools = status[connId]?.tools ?? [];
			const picked = tools.find((t) => t.name === text("tool"));
			return (
				<div className="flex flex-col gap-3">
					<Field label="Connection">
						<Select
							aria-label="Connection"
							value={connId}
							placeholder="Pick a connection"
							onValueChange={(v) => set({ connectionId: v })}
							groups={[{ items: mcp.map((c) => ({ value: c.id, label: c.label })) }]}
						/>
					</Field>
					{type === "mcp-resource" ? (
						<Field label="Resource address">
							<Input aria-label="Resource uri" value={text("uri")} onChange={(e) => set({ uri: e.target.value })} />
						</Field>
					) : (
						<>
							<Field label="Tool">
								{tools.length > 0 ? (
									<Select
										aria-label="Tool"
										value={text("tool")}
										placeholder="Pick a tool"
										onValueChange={(v) => {
											set({ tool: v });
											onExtra({ readOnlyConfirmed: Boolean(tools.find((t) => t.name === v)?.readOnly) });
										}}
										groups={[
											{
												items: tools.map((t) => ({
													value: t.name,
													label: t.name,
													description: t.description.slice(0, 80),
												})),
											},
										]}
									/>
								) : (
									<Input aria-label="Tool" value={text("tool")} onChange={(e) => set({ tool: e.target.value })} />
								)}
							</Field>
							<Field label="Arguments (JSON)">
								<Input
									aria-label="Tool arguments"
									value={text("args")}
									onChange={(e) => set({ args: e.target.value })}
								/>
							</Field>
							{picked?.readOnly ? (
								<p className="text-sm text-success">This tool is marked read-only.</p>
							) : (
								<label className="flex items-center gap-2 text-sm text-fg">
									<input
										type="checkbox"
										className="accent-[var(--od-accent)]"
										checked={extra.readOnlyConfirmed}
										onChange={(e) => onExtra({ readOnlyConfirmed: e.target.checked })}
									/>
									I confirm this tool only reads data
								</label>
							)}
						</>
					)}
				</div>
			);
		}
		default:
			return null;
	}
}

export function everyLabel(w: Pick<Watcher, "type" | "intervalSec">, push: boolean): string {
	if (push || w.type === "schedule") return "instant";
	const s = w.intervalSec;
	if (s < 60) return `every ${s} s`;
	if (s < 3600) return `every ${Math.round(s / 60)} min`;
	return `every ${Math.round(s / 3600)} h`;
}
