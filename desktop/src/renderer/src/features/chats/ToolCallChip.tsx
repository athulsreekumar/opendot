import type { ToolCallView } from "@shared/types";
import { useState } from "react";
import { cn } from "../../design-system/cn";
import { Spinner } from "../../design-system/components";
import { IconCheck, IconChevronDown, IconClock, IconError, IconTool, IconWarning } from "../../design-system/icons";

function unJson(s: string): string {
	try {
		return JSON.parse(`"${s}"`) as string;
	} catch {
		return s;
	}
}

/** Read a string argument from parsed args, falling back to the partially streamed JSON preview. */
export function argString(tool: ToolCallView, key: string): string | undefined {
	const a = tool.args as Record<string, unknown> | undefined;
	if (a && typeof a[key] === "string") return a[key] as string;
	if (!tool.argsPreview) return undefined;
	const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("|$)`).exec(tool.argsPreview);
	return m ? unJson(m[1]!.replace(/\\$/, "")) : undefined;
}

/** `requests[].dot` names of an ask_dots call (parsed args first, then the streamed preview). */
export function argDots(tool: ToolCallView): string[] {
	const a = tool.args as { requests?: Array<{ dot?: string }> } | undefined;
	if (a?.requests?.length) return a.requests.map((r) => r.dot ?? "").filter(Boolean);
	if (!tool.argsPreview) return [];
	return [...tool.argsPreview.matchAll(/"dot"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => unJson(m[1]!));
}

export function toolDuration(tool: ToolCallView): string | undefined {
	if (!tool.endedAt) return undefined;
	const ms = new Date(tool.endedAt).getTime() - new Date(tool.startedAt).getTime();
	if (!Number.isFinite(ms) || ms < 0) return undefined;
	return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function StatusGlyph({ status }: { status: ToolCallView["status"] }) {
	switch (status) {
		case "preparing":
		case "running":
			return <Spinner size={16} />;
		case "done":
			return <IconCheck size={14} className="text-success" />;
		case "error":
			return <IconWarning size={14} className="text-warning" />;
		case "blocked":
			return <IconError size={14} className="text-danger" />;
		case "pending-approval":
			return <IconClock size={14} className="text-warning" />;
	}
}

const STATUS_LABEL: Record<ToolCallView["status"], string> = {
	preparing: "Preparing",
	running: "Running",
	done: "Done",
	error: "Failed",
	blocked: "Blocked",
	"pending-approval": "Waiting for approval",
};

function pretty(v: unknown): string {
	try {
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v);
	}
}

export function ToolCallChip({ tool }: { tool: ToolCallView }) {
	const [open, setOpen] = useState(false);
	const label = `${tool.connectionLabel ? `${tool.connectionLabel} · ` : ""}${tool.label}`;
	const preparing = tool.status === "preparing";
	const dur = toolDuration(tool);
	return (
		<div className="inline-flex max-w-full flex-col align-top">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-label={`${label}, ${STATUS_LABEL[tool.status]}`}
				className={cn(
					"inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-sunken px-2.5 text-xs text-fg-2 transition-colors hover:bg-hover",
					tool.status === "blocked" && "text-danger",
				)}
			>
				<IconTool size={13} className="shrink-0 text-fg-3" />
				<span className="shrink-0 font-medium">{label}</span>
				{preparing && tool.argsPreview && (
					<span className="min-w-0 max-w-[220px] truncate font-mono text-2xs text-fg-3" dir="rtl">
						<bdi>{tool.argsPreview}</bdi>
					</span>
				)}
				<StatusGlyph status={tool.status} />
			</button>
			{open && (
				<div className="mt-1 w-full min-w-[240px] rounded-lg bg-sunken p-2.5 text-xs">
					<div className="mb-1 flex items-center justify-between text-fg-3">
						<span>{STATUS_LABEL[tool.status]}</span>
						<span className="flex items-center gap-1">
							{dur}
							<IconChevronDown size={12} />
						</span>
					</div>
					<pre className="od-selectable max-h-60 overflow-auto whitespace-pre-wrap font-mono text-xs text-fg-2">
						{preparing && tool.argsPreview ? tool.argsPreview : pretty(tool.args)}
					</pre>
					{tool.resultPreview && (
						<pre
							className={cn(
								"od-selectable mt-2 max-h-40 overflow-auto whitespace-pre-wrap border-t border-border-subtle pt-2 font-mono text-xs",
								tool.isError ? "text-danger" : "text-fg-2",
							)}
						>
							{tool.resultPreview}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}

/** Chips for a message, at most 3 then "+N more steps". */
export function ToolCallChips({ tools }: { tools: ToolCallView[] }) {
	const [all, setAll] = useState(false);
	if (tools.length === 0) return null;
	const shown = all ? tools : tools.slice(0, 3);
	return (
		<div className="mt-1.5 flex flex-wrap gap-1.5">
			{shown.map((t) => (
				<ToolCallChip key={t.id} tool={t} />
			))}
			{!all && tools.length > 3 && (
				<button
					type="button"
					onClick={() => setAll(true)}
					className="h-7 rounded-full bg-sunken px-2.5 text-xs text-fg-3 transition-colors hover:bg-hover"
				>
					+{tools.length - 3} more steps
				</button>
			)}
		</div>
	);
}
