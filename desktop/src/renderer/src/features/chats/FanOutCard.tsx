import type { Dot, PeerStreamView, ToolCallView } from "@shared/types";
import { useRef, useState } from "react";
import { cn } from "../../design-system/cn";
import { Avatar, Spinner } from "../../design-system/components";
import { IconCheck, IconClock, IconError, IconWarning } from "../../design-system/icons";
import { useDots } from "../../stores/dots";
import { Markdown } from "./Markdown";
import { argDots } from "./ToolCallChip";

interface Row {
	key: string;
	dot?: Dot;
	name: string;
	stream?: PeerStreamView;
}

function lastLines(text: string, n = 3): string {
	return text
		.split("\n")
		.filter((l) => l.trim())
		.slice(-n)
		.join("\n");
}

function PeerRow({ row, toolRunning, durMs }: { row: Row; toolRunning: boolean; durMs?: number }) {
	const [open, setOpen] = useState(false);
	const s = row.stream;
	const status = s?.status ?? (toolRunning ? "queued" : "done");
	const text = s?.text ?? "";
	const dur = durMs !== undefined ? `${(durMs / 1000).toFixed(1)} s` : "";
	return (
		<div className="flex gap-2 py-1.5">
			{row.dot ? (
				<Avatar
					size="xs"
					color={row.dot.appearance.color}
					emoji={row.dot.appearance.emoji}
					name={row.dot.name}
					mark={row.dot.kind === "super"}
				/>
			) : (
				<span className="h-6 w-6 shrink-0 rounded-full bg-active" />
			)}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 text-sm">
					<span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
					<span
						className={cn(
							"flex shrink-0 items-center gap-1 text-2xs",
							status === "error"
								? "text-danger"
								: status === "blocked"
									? "text-danger"
									: status === "done"
										? "text-success"
										: "text-fg-3",
						)}
					>
						{status === "queued" && (
							<>
								<IconClock size={12} />
								queued
							</>
						)}
						{status === "running" && (
							<>
								<Spinner size={16} />
								{text ? "streaming" : "thinking…"}
							</>
						)}
						{status === "done" && (
							<>
								<IconCheck size={12} />
								{dur || "done"}
							</>
						)}
						{status === "error" && <IconWarning size={12} />}
						{status === "blocked" && <IconError size={12} />}
					</span>
				</div>
				{(status === "error" || status === "blocked") && (
					<div className="text-xs text-danger">{s?.error ?? (status === "blocked" ? "Blocked" : "No reply")}</div>
				)}
				{text && (
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						aria-expanded={open}
						className="block w-full text-left"
					>
						{open && status === "done" ? (
							<Markdown text={text} />
						) : (
							<span
								className={cn("od-selectable block whitespace-pre-wrap text-xs text-fg-2", !open && "line-clamp-3")}
							>
								{open ? text : lastLines(text)}
							</span>
						)}
					</button>
				)}
			</div>
		</div>
	);
}

/** ask_dots tool call: one row per Dot, streaming in parallel (spec 13 §5). */
export function FanOutCard({ tool, streams }: { tool: ToolCallView; streams?: Record<string, PeerStreamView> }) {
	const dots = useDots((s) => s.dots);
	const times = useRef<Record<string, { start: number; dur?: number }>>({});
	const names = argDots(tool);
	const rows: Row[] = [];
	const seen = new Set<string>();
	for (const n of names) {
		const dot = dots.find((d) => d.name.toLowerCase() === n.toLowerCase() || d.id === n);
		const key = dot?.id ?? n;
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push({ key, dot, name: dot?.name ?? n, stream: streams?.[key] });
	}
	for (const [peerId, st] of Object.entries(streams ?? {})) {
		if (seen.has(peerId)) continue;
		const dot = dots.find((d) => d.id === peerId);
		rows.push({ key: peerId, dot, name: dot?.name ?? peerId, stream: st });
	}
	const toolRunning = tool.status === "preparing" || tool.status === "running";
	const now = Date.now();
	for (const r of rows) {
		const t = times.current[r.key] ?? { start: now };
		times.current[r.key] = t;
		if (r.stream?.status === "done" && t.dur === undefined) t.dur = now - t.start;
	}
	if (rows.length === 0) {
		return (
			<div className="my-1 flex min-w-[260px] items-center gap-2 rounded-lg bg-bubble-link p-2.5 text-sm text-fg-2">
				<Spinner size={16} />
				Choosing who to ask…
			</div>
		);
	}
	return (
		<div className="my-1 min-w-[260px] divide-y divide-border-subtle rounded-lg bg-bubble-link px-2.5 py-1">
			{rows.map((r) => (
				<PeerRow
					key={r.key}
					row={r}
					toolRunning={toolRunning}
					durMs={r.stream?.status === "done" ? times.current[r.key]?.dur : undefined}
				/>
			))}
		</div>
	);
}
