// Maps pi messages / session entries to renderer view models.

import type { ChatMessageView, DotEventView, DotId, ToolCallView } from "../../shared/types";
import { sourcesFromDetails } from "../knowledge/sources";

type Block = {
	type: string;
	text?: string;
	thinking?: string;
	redacted?: boolean;
	id?: string;
	name?: string;
	arguments?: unknown;
};
export type AnyMessage = {
	role: string;
	content?: unknown;
	timestamp?: number;
	customType?: string;
	display?: boolean;
	details?: unknown;
	toolCallId?: string;
	toolName?: string;
	isError?: boolean;
	usage?: { input?: number; output?: number; cost?: { total?: number } };
	errorMessage?: string;
	stopReason?: string;
};

const LABELS: Record<string, string> = {
	gmail: "Gmail",
	calendar: "Calendar",
	drive: "Drive",
	outlook: "Outlook",
	onedrive: "OneDrive",
	teams: "Teams",
	mac: "Mac",
	knowledge: "Knowledge",
	read: "Files · read",
	write: "Files · write",
	edit: "Files · edit",
	ls: "Files · list",
	grep: "Files · search",
	find: "Files · find",
	bash: "Shell",
	list_dots: "Dots · list",
	message_dot: "Message a Dot",
	ask_dots: "Ask Dots",
	get_dot_updates: "Dot updates",
	search_dot_history: "Search Dot history",
	remember: "Memory · save",
	forget: "Memory · forget",
	recall: "Memory · recall",
	codemode: "Code",
	tool_search: "Tool search",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function humanToolLabel(name: string): string {
	if (LABELS[name]) return LABELS[name];
	const mcp = /^mcp__([^_].*?)__(.+)$/.exec(name);
	if (mcp) return `${cap(mcp[1]!.replace(/[_-]/g, " "))} · ${mcp[2]!.replace(/_/g, " ")}`;
	const parts = name.split("_");
	if (parts.length > 1 && LABELS[parts[0]!]) {
		if (parts[0] === "mac") return `${cap(parts[1]!)} · ${parts.slice(2).join(" ") || parts[1]}`;
		return `${LABELS[parts[0]!]} · ${parts.slice(1).join(" ")}`;
	}
	return name.replace(/_/g, " ");
}

export function blocksText(content: unknown, kind: "text" | "thinking" = "text"): string {
	if (typeof content === "string") return kind === "text" ? content : "";
	if (!Array.isArray(content)) return "";
	return (content as Block[])
		.filter((b) => b.type === kind && !b.redacted)
		.map((b) => (kind === "text" ? (b.text ?? "") : (b.thinking ?? "")))
		.join("");
}

export function toolCallsOf(content: unknown): Array<{ id: string; name: string; args: unknown }> {
	if (!Array.isArray(content)) return [];
	return (content as Block[])
		.filter((b) => b.type === "toolCall")
		.map((b) => ({ id: b.id ?? "", name: b.name ?? "", args: b.arguments ?? {} }));
}

export function previewOf(content: unknown, max = 2000): string {
	const t = typeof content === "string" ? content : blocksText(content);
	return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function stripMarkdown(s: string): string {
	return s
		.replace(/```[\s\S]*?```/g, "[code]")
		.replace(/[*_`#>]+/g, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/\s+/g, " ")
		.trim();
}

export function previewLine(s: string, max = 120): string {
	const t = stripMarkdown(s);
	return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export interface EntryLike {
	type: string;
	id: string;
	timestamp: string;
	message?: AnyMessage;
	customType?: string;
	content?: unknown;
	display?: boolean;
	details?: unknown;
}

/** Convert an active session branch to chat views (tool results folded into the preceding assistant). */
export function entriesToViews(
	dotId: DotId,
	entries: EntryLike[],
	restore: (s: string) => string,
	eventsById: Map<string, DotEventView>,
): ChatMessageView[] {
	const out: ChatMessageView[] = [];
	const toolIndex = new Map<string, ToolCallView>();
	let lastWasEvents = false;
	for (const e of entries) {
		if (e.type === "custom_message" && e.customType === "opendot.events") {
			const ids = ((e.details as { eventIds?: string[] } | undefined)?.eventIds ?? []) as string[];
			out.push({
				id: e.id,
				dotId,
				role: "event",
				text: "",
				toolCalls: [],
				createdAt: e.timestamp,
				streaming: false,
				events: ids.map((id) => eventsById.get(id)).filter((x): x is DotEventView => !!x),
			});
			lastWasEvents = true;
			continue;
		}
		if (
			e.type === "custom_message" &&
			(e.customType === "opendot.direct-ask" || e.customType === "opendot.direct-reply")
		) {
			out.push({
				id: e.id,
				dotId,
				role: e.customType === "opendot.direct-ask" ? "user" : "assistant",
				text: restore(blocksText(e.content)),
				toolCalls: [],
				createdAt: e.timestamp,
				streaming: false,
			});
			continue;
		}
		if (e.type !== "message" || !e.message) continue;
		const m = e.message;
		const createdAt = m.timestamp ? new Date(m.timestamp).toISOString() : e.timestamp;
		if (m.role === "user") {
			out.push({
				id: e.id,
				dotId,
				role: "user",
				text: restore(blocksText(m.content)),
				toolCalls: [],
				createdAt,
				streaming: false,
			});
			lastWasEvents = false;
		} else if (m.role === "assistant") {
			let text = restore(blocksText(m.content));
			let importance: ChatMessageView["importance"];
			let hidden = false;
			if (lastWasEvents) {
				const t = text.trimStart();
				if (t.startsWith("NO_UPDATE")) {
					hidden = true;
					importance = "quiet";
				} else {
					const mm = /^\[(URGENT|UPDATE)\]\s*/.exec(t);
					if (mm) {
						importance = mm[1] === "URGENT" ? "urgent" : "update";
						text = t.slice(mm[0].length);
					}
				}
			}
			const tools: ToolCallView[] = toolCallsOf(m.content).map((tc) => {
				const v: ToolCallView = {
					id: tc.id,
					name: tc.name,
					label: humanToolLabel(tc.name),
					args: tc.args,
					status: "done",
					startedAt: createdAt,
				};
				toolIndex.set(tc.id, v);
				return v;
			});
			out.push({
				id: e.id,
				dotId,
				role: "assistant",
				text,
				thinking: restore(blocksText(m.content, "thinking")) || undefined,
				toolCalls: tools,
				createdAt,
				streaming: false,
				error: m.stopReason === "error" ? (m.errorMessage ?? "The model returned an error.") : undefined,
				importance,
				hidden,
				usage: m.usage
					? { input: m.usage.input ?? 0, output: m.usage.output ?? 0, costUsd: m.usage.cost?.total }
					: undefined,
			});
			if (!tools.length) lastWasEvents = false;
		} else if (m.role === "toolResult" && m.toolCallId) {
			const v = toolIndex.get(m.toolCallId);
			if (v) {
				v.resultPreview = restore(previewOf(m.content));
				const sources = sourcesFromDetails(v.name, m.details);
				if (sources) v.sources = sources;
				v.isError = !!m.isError;
				v.status = m.isError ? "error" : "done";
			}
		}
	}
	return out;
}
