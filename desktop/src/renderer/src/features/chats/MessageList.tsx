import { resolveBriefing } from "@shared/defaults";
import type { ChatMessageView, DotId } from "@shared/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { cn } from "../../design-system/cn";
import { Spinner, toast } from "../../design-system/components";
import { IconArrowDown } from "../../design-system/icons";
import { errorText } from "../../lib/api";
import { dayLabel } from "../../lib/format";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useSettings } from "../../stores/settings";
import { useUi } from "../../stores/ui";
import { DaySeparator } from "./DaySeparator";
import { type BubbleMeta, MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

type Item =
	| { kind: "day"; key: string; label: string }
	| { kind: "msg"; key: string; role: ChatMessageView["role"]; meta: BubbleMeta }
	| { kind: "chips"; key: string }
	| { kind: "typing"; key: string };

const GROUP_MS = 5 * 60 * 1000;
const START_INDEX = 1_000_000;

/** Cheap signature of what affects list structure (not text), so deltas never re-render the list. */
function structureKey(dotId: DotId) {
	return (s: ReturnType<typeof useChat.getState>): string => {
		const c = s.byDot[dotId];
		if (!c) return "";
		let out = "";
		for (const id of c.order) {
			const m = c.byId[id];
			if (m && !m.hidden) out += `${id}|${m.role}|${m.createdAt}|${m.error ? 1 : 0}|${m.briefing ? 1 : 0};`;
		}
		return out;
	};
}

function buildItems(dotId: DotId, typing: boolean, showChips: boolean): Item[] {
	const msgs = useChat.getState().messages(dotId);
	const items: Item[] = [];
	let lastUser: string | undefined;
	let lastAssistantIdx = -1;
	msgs.forEach((m, i) => {
		if (m.role === "assistant") lastAssistantIdx = i;
	});
	let prev: ChatMessageView | undefined;
	msgs.forEach((m, i) => {
		const day = new Date(m.createdAt).toDateString();
		const newDay = !prev || new Date(prev.createdAt).toDateString() !== day;
		if (newDay) items.push({ kind: "day", key: `day:${day}`, label: dayLabel(m.createdAt) });
		const grouped =
			!newDay &&
			!!prev &&
			prev.role === m.role &&
			(m.role === "user" || m.role === "assistant") &&
			Math.abs(new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < GROUP_MS;
		const next = msgs[i + 1];
		if (m.role === "user") lastUser = m.text;
		items.push({
			kind: "msg",
			key: m.id,
			role: m.role,
			meta: {
				id: m.id,
				grouped,
				followedByAssistant: msgs.slice(i + 1).some((x) => x.role === "assistant") || next?.role === "assistant",
				isLastAssistant: i === lastAssistantIdx,
				briefingFirst: !!m.briefing && !prev?.briefing,
				retryText: m.role === "assistant" ? lastUser : undefined,
			},
		});
		prev = m;
	});
	if (showChips) items.push({ kind: "chips", key: "chips" });
	if (typing) items.push({ kind: "typing", key: "typing" });
	return items;
}

function suggestionsFor(kind: "super" | "standard", dotNames: string[]): string[] {
	if (kind === "super") {
		const base = ["What's new today?", "Anything urgent?"];
		if (dotNames.some((n) => /calendar/i.test(n))) base.push("What's on my calendar tomorrow?");
		else base.push("What can you help me with?");
		return base;
	}
	return ["What can you help me with?", "Show me what you can do", "Give me a quick example"];
}

function Chips({ dotId, kind }: { dotId: DotId; kind: "super" | "standard" }) {
	const names = useDots((s) => s.dots.map((d) => d.name).join("\u0000"));
	const list = suggestionsFor(kind, names.split("\u0000"));
	const briefingOn = useSettings((s) => !!s.settings?.briefing?.enabled);
	return (
		<div className="flex flex-wrap gap-2 pt-2">
			{kind === "super" && !briefingOn && <BriefingChip />}
			{list.map((c) => (
				<SuggestionChip key={c} dotId={dotId} text={c} />
			))}
		</div>
	);
}

/** One-click switch-on for the daily briefing (spec 13 §6). */
function BriefingChip() {
	const enable = () => {
		const cur = useSettings.getState().settings;
		void useSettings
			.getState()
			.update({ briefing: { ...resolveBriefing(cur), enabled: true, time: "08:00" } })
			.then(() =>
				toast({ title: "Daily briefing is on", description: "You'll get it at 8:00 on weekdays.", variant: "success" }),
			)
			.catch((e) => toast({ title: "Couldn't turn it on", description: errorText(e), variant: "error" }));
	};
	return (
		<button
			type="button"
			onClick={enable}
			className="h-8 rounded-full border border-accent bg-accent-subtle px-3 text-sm font-medium text-accent transition-colors hover:bg-hover"
		>
			Get a daily briefing at 8:00
		</button>
	);
}

function SuggestionChip({ dotId, text }: { dotId: DotId; text: string }) {
	return (
		<button
			type="button"
			onClick={() => {
				useUi.getState().setDraft(dotId, text);
				window.dispatchEvent(new CustomEvent("od:focus-composer"));
			}}
			className="h-8 rounded-full border border-border bg-elevated px-3 text-sm text-fg transition-colors hover:bg-hover"
		>
			{text}
		</button>
	);
}

export function MessageList({ dotId }: { dotId: DotId }) {
	const sig = useChat(structureKey(dotId));
	const loaded = useChat((s) => !!s.byDot[dotId]?.loaded);
	const loading = useChat((s) => !!s.byDot[dotId]?.loading);
	const kind = useDots((s) => s.byId(dotId)?.kind ?? "standard");
	const statusKind = useDots((s) => s.statuses[dotId]?.kind);
	const streamingAssistant = useChat((s) => {
		const c = s.byDot[dotId];
		if (!c) return false;
		for (let i = c.order.length - 1; i >= Math.max(0, c.order.length - 5); i--) {
			const m = c.byId[c.order[i]!];
			if (m?.streaming && m.role === "assistant") return true;
		}
		return false;
	});
	const lastStreaming = useChat((s) => {
		const c = s.byDot[dotId];
		const m = c?.byId[c.order[c.order.length - 1] ?? ""];
		return !!m?.streaming;
	});
	const typing = (statusKind === "thinking" || statusKind === "handling-events") && !streamingAssistant;
	const onlyGreeting = useChat((s) => {
		const msgs = s.messages(dotId);
		return msgs.length === 1 && msgs[0]!.role === "assistant" && msgs[0]!.id.startsWith("greeting_");
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: sig tracks the message list
	const items = useMemo(() => buildItems(dotId, typing, onlyGreeting), [dotId, sig, typing, onlyGreeting]);

	// Virtuoso needs a stable firstItemIndex when older messages are prepended.
	const first = useRef<{ key?: string; index: number; firstItemIndex: number }>({
		index: 0,
		firstItemIndex: START_INDEX,
	});
	const firstMsgIdx = items.findIndex((i) => i.kind === "msg");
	const firstMsgKey = firstMsgIdx >= 0 ? items[firstMsgIdx]!.key : undefined;
	if (first.current.key !== firstMsgKey && firstMsgKey !== undefined) {
		if (first.current.key !== undefined) {
			const idx = items.findIndex((i) => i.key === first.current.key);
			if (idx > first.current.index) first.current.firstItemIndex -= idx - first.current.index;
		}
		first.current.key = firstMsgKey;
		first.current.index = firstMsgIdx;
	} else {
		first.current.index = firstMsgIdx;
	}
	const firstItemIndex = first.current.firstItemIndex;

	const ref = useRef<VirtuosoHandle>(null);
	const [atBottom, setAtBottom] = useState(true);
	const [newCount, setNewCount] = useState(0);
	const prevLast = useRef<{ key?: string; count: number }>({ count: 0 });

	const msgCount = items.filter((i) => i.kind === "msg").length;
	const lastMsg = [...items].reverse().find((i) => i.kind === "msg");
	useEffect(() => {
		const p = prevLast.current;
		if (lastMsg && p.key !== undefined && lastMsg.key !== p.key && msgCount > p.count) {
			if (lastMsg.kind === "msg" && lastMsg.role === "user") {
				ref.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" });
			} else if (!atBottom) setNewCount((n) => n + (msgCount - p.count));
		}
		prevLast.current = { key: lastMsg?.key, count: msgCount };
	}, [lastMsg, msgCount, atBottom]);
	useEffect(() => {
		if (atBottom) setNewCount(0);
	}, [atBottom]);

	// A briefing notification was clicked: scroll to the newest briefing card.
	useEffect(() => {
		const on = (e: Event) => {
			if ((e as CustomEvent<{ dotId?: string }>).detail?.dotId !== dotId) return;
			let at = -1;
			items.forEach((it, i) => {
				if (it.kind === "msg" && it.meta.briefingFirst) at = i;
			});
			if (at >= 0) ref.current?.scrollToIndex({ index: at, align: "start", behavior: "smooth" });
		};
		window.addEventListener("od:scroll-briefing", on);
		return () => window.removeEventListener("od:scroll-briefing", on);
	}, [dotId, items]);

	const loadMore = useCallback(() => void useChat.getState().loadMore(dotId), [dotId]);

	if (!loaded)
		return (
			<div className="od-chat-wallpaper flex min-h-0 flex-1 items-center justify-center">
				<Spinner size={24} />
			</div>
		);

	return (
		<div className="od-chat-wallpaper relative min-h-0 flex-1">
			<Virtuoso
				ref={ref}
				className="h-full"
				data={items}
				firstItemIndex={firstItemIndex}
				initialTopMostItemIndex={{ index: "LAST", align: "end" }}
				alignToBottom
				atBottomThreshold={64}
				atBottomStateChange={setAtBottom}
				followOutput={(isAtBottom) => (isAtBottom ? (lastStreaming ? "auto" : "smooth") : false)}
				startReached={loadMore}
				increaseViewportBy={{ top: 400, bottom: 400 }}
				computeItemKey={(_, item) => item.key}
				components={{
					Header: () => (
						<div className="flex h-6 items-center justify-center pt-2">{loading && <Spinner size={16} />}</div>
					),
					Footer: () => <div className="h-3" />,
				}}
				itemContent={(_, item) => (
					<div
						className={cn(
							"mx-auto w-full max-w-[var(--od-chat-max-w)] px-6",
							item.kind === "msg" ? (item.meta.grouped ? "pt-0.5" : "pt-2.5") : "pt-1",
						)}
					>
						{item.kind === "day" && <DaySeparator label={item.label} />}
						{item.kind === "msg" && (
							<div className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
								<MessageBubble meta={item.meta} dotId={dotId} />
							</div>
						)}
						{item.kind === "chips" && <Chips dotId={dotId} kind={kind} />}
						{item.kind === "typing" && <TypingIndicator />}
					</div>
				)}
			/>
			{!atBottom && (
				<button
					type="button"
					onClick={() => ref.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" })}
					className="absolute bottom-3 right-6 z-sticky flex h-9 items-center gap-1.5 rounded-full bg-elevated px-3 text-sm font-medium text-fg shadow-md transition-colors hover:bg-hover"
				>
					<IconArrowDown size={14} />
					{newCount > 0 ? `${newCount} new` : "Latest"}
				</button>
			)}
		</div>
	);
}
