import type { ChatMessageView } from "@shared/types";
import { memo, useState } from "react";
import { cn } from "../../design-system/cn";
import { toast } from "../../design-system/components";
import {
	IconCheck,
	IconChevronRight,
	IconClock,
	IconCopy,
	IconRetry,
	IconShield,
	IconSunrise,
} from "../../design-system/icons";
import { bubbleTime } from "../../lib/format";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { EventCard } from "./EventCard";
import { FanOutCard } from "./FanOutCard";
import { KnowledgeSources } from "./KnowledgeSources";
import { LinkCard, LinkExchangeCard } from "./LinkCard";
import { StreamingMarkdown } from "./StreamingMarkdown";
import { ToolCallChips } from "./ToolCallChip";
import { TypingDots } from "./TypingIndicator";

export interface BubbleMeta {
	id: string;
	/** Tight spacing, no tail. */
	grouped: boolean;
	/** A visible assistant message follows. */
	followedByAssistant: boolean;
	isLastAssistant: boolean;
	/** First message of a briefing card (shows the "Briefing · Tue 7 Oct" header). */
	briefingFirst?: boolean;
	/** Text of the user message to resend on Retry. */
	retryText?: string;
}

function Thinking({ text, streaming }: { text: string; streaming: boolean }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="mb-1">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="flex items-center gap-1 text-xs italic text-fg-3 transition-colors hover:text-fg-2"
			>
				<IconChevronRight size={12} className={cn("transition-transform", open && "rotate-90")} />
				{streaming ? "Thinking…" : "Thought"}
			</button>
			{open && (
				<div className="od-selectable mt-1 whitespace-pre-wrap border-l-2 border-border pl-2 text-xs text-fg-3">
					{text}
				</div>
			)}
		</div>
	);
}

export const MessageBubble = memo(function MessageBubble({ meta, dotId }: { meta: BubbleMeta; dotId: string }) {
	const m = useChat((s) => s.byDot[dotId]?.byId[meta.id]);
	const dotName = useDots((s) => s.byId(dotId)?.name ?? "Dot");
	if (!m) return null;
	return <Inner m={m} meta={meta} dotName={dotName} />;
}, sameProps);

function sameProps(a: { meta: BubbleMeta; dotId: string }, b: { meta: BubbleMeta; dotId: string }): boolean {
	return (
		a.dotId === b.dotId &&
		a.meta.id === b.meta.id &&
		a.meta.grouped === b.meta.grouped &&
		a.meta.followedByAssistant === b.meta.followedByAssistant &&
		a.meta.isLastAssistant === b.meta.isLastAssistant &&
		a.meta.briefingFirst === b.meta.briefingFirst &&
		a.meta.retryText === b.meta.retryText
	);
}

function Inner({ m, meta, dotName }: { m: ChatMessageView; meta: BubbleMeta; dotName: string }) {
	if (m.role === "event") return <EventCard message={m} followedByReply={meta.followedByAssistant} />;
	if (m.role === "link-in" || m.role === "link-out")
		return (
			<div className="w-full max-w-[min(72%,640px)]">
				<LinkExchangeCard message={m} />
			</div>
		);
	if (m.role === "system")
		return (
			<div className="flex w-full justify-center">
				<span className="rounded-lg bg-bubble-system px-3 py-1 text-center text-xs text-fg-2 shadow-bubble">
					{m.text}
				</span>
			</div>
		);
	return <Bubble m={m} meta={meta} dotName={dotName} />;
}

function Bubble({ m, meta, dotName }: { m: ChatMessageView; meta: BubbleMeta; dotName: string }) {
	const out = m.role === "user";
	const time = bubbleTime(m.createdAt);
	const send = useChat((s) => s.send);
	const retryable = m.error || (meta.isLastAssistant && meta.retryText);
	const retry = () => {
		if (meta.retryText) void send(m.dotId, meta.retryText);
		else if (out) void send(m.dotId, m.text);
	};
	const copy = () => {
		void navigator.clipboard?.writeText(m.text).then(() => toast({ title: "Copied", variant: "success" }));
	};
	const linkTools = m.toolCalls.filter((t) => t.name === "message_dot");
	const fanTools = m.toolCalls.filter((t) => t.name === "ask_dots");
	const chipTools = m.toolCalls.filter((t) => t.name !== "message_dot" && t.name !== "ask_dots");
	const emptyStreaming = m.streaming && !m.text && !m.thinking && m.toolCalls.length === 0;
	const local = m.id.startsWith("local_");
	const glyph = out ? (
		local && !m.error ? (
			<IconClock size={11} className="text-fg-3" aria-label="Sending" />
		) : meta.followedByAssistant ? (
			<span className="flex text-accent" role="img" aria-label="Seen">
				<IconCheck size={11} />
				<IconCheck size={11} className="-ml-1.5" />
			</span>
		) : (
			<IconCheck size={11} className="text-fg-3" aria-label="Sent" />
		)
	) : null;
	return (
		<article
			aria-label={`${out ? "You" : dotName}, ${time}`}
			data-briefing={m.briefing ? "" : undefined}
			className={cn(
				"group relative max-w-[min(72%,640px)] rounded-bubble px-2.5 pb-1.5 pt-2 shadow-bubble",
				out ? "bg-bubble-out text-bubble-out-fg" : "bg-bubble-in text-bubble-in-fg",
				m.briefing && "w-full border-l-4 border-accent",
				!meta.grouped && (out ? "rounded-tr-[4px]" : "rounded-tl-[4px]"),
				m.queued && "opacity-60",
				(fanTools.length > 0 || linkTools.length > 0) && "w-full",
			)}
		>
			{m.briefing && meta.briefingFirst && (
				<div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
					<IconSunrise size={14} />
					<span>{m.briefing.label}</span>
				</div>
			)}
			{m.importance === "urgent" && (
				<span className="mb-1 inline-flex h-5 items-center rounded-sm bg-danger-subtle px-1.5 text-2xs font-medium text-danger">
					Urgent
				</span>
			)}
			{m.thinking && m.role === "assistant" && <Thinking text={m.thinking} streaming={m.streaming} />}
			{fanTools.map((t) => (
				<FanOutCard key={t.id} tool={t} streams={m.peerStreams?.[t.id]} />
			))}
			{linkTools.map((t) => (
				<LinkCard key={t.id} tool={t} />
			))}
			{emptyStreaming ? (
				<TypingDots />
			) : out ? (
				<div className="od-selectable whitespace-pre-wrap break-words text-md">{m.text}</div>
			) : m.text || m.streaming ? (
				<StreamingMarkdown text={m.text} streaming={m.streaming} messageId={m.id} />
			) : null}
			<ToolCallChips tools={chipTools} />
			{!out && m.role === "assistant" && !m.streaming && m.text && (
				<KnowledgeSources dotId={m.dotId} messageId={m.id} answer={m.text} />
			)}
			{m.error && (
				<div
					className="mt-1.5 flex items-center gap-1.5 rounded-md bg-danger-subtle px-2 py-1 text-xs text-danger"
					title={m.error}
				>
					<span>Couldn't get a reply</span>
					<span aria-hidden="true">·</span>
					<button type="button" onClick={retry} className="font-medium underline-offset-2 hover:underline">
						Retry
					</button>
				</div>
			)}
			<div className="flex h-[14px] items-center justify-end gap-1.5 text-2xs text-fg-3">
				{m.queued && <span className="italic">queued</span>}
				{m.pii && (
					<span
						className="flex items-center gap-0.5 rounded-full bg-accent-subtle px-1.5 text-accent"
						title={m.pii.types.join(", ")}
					>
						<IconShield size={10} />
						{m.pii.count}
					</span>
				)}
				<span>{time}</span>
				{glyph}
			</div>
			{!emptyStreaming && !m.streaming && (m.text || retryable) && (
				<div className="absolute -top-3 right-2 flex gap-0.5 rounded-md bg-elevated p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
					<button
						type="button"
						aria-label="Copy message"
						onClick={copy}
						className="rounded-sm p-1 text-fg-2 hover:bg-hover"
					>
						<IconCopy size={13} />
					</button>
					{!out && meta.isLastAssistant && meta.retryText && (
						<button
							type="button"
							aria-label="Retry"
							onClick={retry}
							className="rounded-sm p-1 text-fg-2 hover:bg-hover"
						>
							<IconRetry size={13} />
						</button>
					)}
				</div>
			)}
		</article>
	);
}
