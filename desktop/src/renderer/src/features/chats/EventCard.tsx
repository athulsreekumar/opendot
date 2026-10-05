import type { ChatMessageView, DotEventView } from "@shared/types";
import { useState } from "react";
import { Spinner } from "../../design-system/components";
import {
	IconCalendar,
	IconClock,
	IconCloud,
	IconFolder,
	IconGlobe,
	IconMail,
	IconRss,
	IconWebhook,
	IconZap,
} from "../../design-system/icons";
import { bubbleTime } from "../../lib/format";
import { useDots } from "../../stores/dots";

function SourceIcon({ type }: { type: string }) {
	const p = { size: 14, className: "shrink-0 text-fg-3" };
	if (type.includes("calendar")) return <IconCalendar {...p} />;
	if (type.includes("mail") || type === "gmail") return <IconMail {...p} />;
	if (type === "rss") return <IconRss {...p} />;
	if (type === "folder") return <IconFolder {...p} />;
	if (type === "url") return <IconGlobe {...p} />;
	if (type.includes("webhook")) return <IconWebhook {...p} />;
	if (type === "schedule") return <IconClock {...p} />;
	if (type.includes("drive")) return <IconCloud {...p} />;
	return <IconZap {...p} />;
}

function Row({ e }: { e: DotEventView }) {
	return (
		<div className="flex h-6 items-center gap-2 text-sm">
			<SourceIcon type={e.type} />
			<span className="min-w-0 flex-1 truncate text-fg">{e.title}</span>
			<span className="shrink-0 text-2xs text-fg-3">{bubbleTime(e.occurredAt)}</span>
		</div>
	);
}

export function EventCard({ message, followedByReply }: { message: ChatMessageView; followedByReply: boolean }) {
	const [all, setAll] = useState(false);
	const dot = useDots((s) => s.byId(message.dotId));
	const status = useDots((s) => s.statuses[message.dotId]);
	const events = message.events ?? [];
	const shown = all ? events : events.slice(0, 3);
	const reading = status?.kind === "handling-events" && !followedByReply;
	return (
		<div className="my-1 w-full max-w-[min(72%,640px)] rounded-lg bg-sunken px-3 py-2 shadow-bubble">
			{shown.map((e) => (
				<Row key={e.id} e={e} />
			))}
			{!all && events.length > 3 && (
				<button
					type="button"
					onClick={() => setAll(true)}
					className="mt-0.5 text-xs text-fg-3 transition-colors hover:text-fg-2"
				>
					+{events.length - 3} more
				</button>
			)}
			{reading ? (
				<div className="mt-1 flex items-center gap-1.5 text-2xs text-fg-3">
					<Spinner size={16} />
					{dot?.name ?? "Your Dot"} is reading…
				</div>
			) : !followedByReply ? (
				<div className="mt-1 text-2xs text-fg-3">Handled quietly</div>
			) : null}
		</div>
	);
}
