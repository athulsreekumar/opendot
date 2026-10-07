import type { KnowledgeSourceView } from "@shared/types";
import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "../../design-system/components";
import { api, errorText } from "../../lib/api";
import { type DotChat, useChat } from "../../stores/chat";

const MAX_SHOWN = 4;

/** Sources the Dot retrieved in the run that ends at `messageId` (since the last user message), as a stable JSON string. */
export function runSourcesKey(chat: DotChat | undefined, messageId: string): string {
	const m = chat?.byId[messageId];
	if (!chat || !m || m.role !== "assistant" || m.streaming) return "";
	const i = chat.order.lastIndexOf(messageId);
	if (i < 0) return "";
	// Only the last assistant message of a run (the answer) carries the chips.
	if (chat.byId[chat.order[i + 1] ?? ""]?.role === "assistant") return "";
	const out: KnowledgeSourceView[] = [];
	for (let j = i; j >= 0; j--) {
		const x = chat.byId[chat.order[j]!];
		if (!x) continue;
		if (x.role === "user" || x.role === "event") break;
		if (x.role !== "assistant") continue;
		for (const t of x.toolCalls) if (t.sources && t.status === "done") out.push(...t.sources);
	}
	return out.length ? JSON.stringify(out) : "";
}

/** Drop repeats, and a bare file entry when the same file already has a heading entry. */
export function dedupeSources(list: KnowledgeSourceView[]): KnowledgeSourceView[] {
	const withHeading = new Set(list.filter((s) => s.heading).map((s) => s.path));
	const seen = new Set<string>();
	const out: KnowledgeSourceView[] = [];
	for (const s of list) {
		if (!s.heading && withHeading.has(s.path)) continue;
		const key = `${s.path}\0${s.heading ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(s);
	}
	return out;
}

/** Prefer the files the answer actually names; otherwise the top few retrieved. */
export function pickCited(list: KnowledgeSourceView[], answer: string): KnowledgeSourceView[] {
	const text = answer.toLowerCase();
	const cited = list.filter((s) => text.includes(s.name.toLowerCase()));
	return cited.length ? cited : list;
}

export function chipLabel(s: KnowledgeSourceView): string {
	return s.heading ? `${s.name} · ${s.heading}` : s.name;
}

export function KnowledgeSources({ dotId, messageId, answer }: { dotId: string; messageId: string; answer: string }) {
	const key = useChat((s) => runSourcesKey(s.byDot[dotId], messageId));
	const [all, setAll] = useState(false);
	const sources = useMemo(
		() => (key ? pickCited(dedupeSources(JSON.parse(key) as KnowledgeSourceView[]), answer) : []),
		[key, answer],
	);
	if (sources.length === 0) return null;
	const shown = all ? sources : sources.slice(0, MAX_SHOWN);
	const open = (s: KnowledgeSourceView) =>
		api.knowledge
			.open(s.path)
			.catch((e) => toast({ title: "Couldn't open the file", description: errorText(e), variant: "error" }));
	return (
		<div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="knowledge-sources">
			<span className="text-2xs text-fg-3">Sources</span>
			{shown.map((s) => (
				<button
					key={`${s.path}\0${s.heading ?? ""}`}
					type="button"
					onClick={() => void open(s)}
					onContextMenu={(e) => {
						e.preventDefault();
						void api.knowledge.reveal(s.path).catch(() => undefined);
					}}
					title={`${s.path}\nLines ${s.startLine}-${s.endLine}. Click to open, right-click to show in folder.`}
					aria-label={`Open ${chipLabel(s)}`}
					className="inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-full bg-sunken px-2.5 text-xs text-fg-2 transition-colors hover:bg-hover"
				>
					<FileText size={13} className="shrink-0 text-fg-3" aria-hidden />
					<span className="truncate">{chipLabel(s)}</span>
				</button>
			))}
			{!all && sources.length > MAX_SHOWN && (
				<button
					type="button"
					onClick={() => setAll(true)}
					className="h-7 rounded-full bg-sunken px-2.5 text-xs text-fg-3 transition-colors hover:bg-hover"
				>
					+{sources.length - MAX_SHOWN} more
				</button>
			)}
		</div>
	);
}
