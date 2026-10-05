import type { ChatMessageView, DotId, LinkExchange } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/design-system/cn";
import { Badge, Sheet, Spinner } from "@/design-system/components";
import { api } from "@/lib/api";
import { bubbleTime, relativeTime } from "@/lib/format";
import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";

const STATUS: Record<
	LinkExchange["status"],
	{ label: string; variant: "muted" | "success" | "warning" | "danger" | "info" }
> = {
	"pending-approval": { label: "Waiting for you", variant: "warning" },
	running: { label: "Talking", variant: "info" },
	done: { label: "Replied", variant: "success" },
	rejected: { label: "Blocked", variant: "danger" },
	error: { label: "Error", variant: "danger" },
	timeout: { label: "Timed out", variant: "muted" },
};

export function LinkActivity() {
	const dots = useDots((s) => s.dots);
	const live = useRuntime((s) => s.exchanges);
	const [loaded, setLoaded] = useState<LinkExchange[] | undefined>();
	const [open, setOpen] = useState<LinkExchange | undefined>();

	useEffect(() => {
		api.links
			.exchanges({ limit: 50 })
			.then(setLoaded)
			.catch(() => setLoaded([]));
	}, []);

	const items = useMemo(() => {
		const map = new Map<string, LinkExchange>();
		for (const x of loaded ?? []) map.set(x.id, x);
		for (const x of live) map.set(x.id, x);
		return [...map.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50);
	}, [loaded, live]);

	const name = (id: DotId) => dots.find((d) => d.id === id)?.name ?? "Removed Dot";

	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-lg font-semibold text-fg">Activity</h2>
			{!loaded ? (
				<Spinner size={20} />
			) : items.length === 0 ? (
				<p className="text-sm text-fg-3">When Dots talk to each other, it shows up here.</p>
			) : (
				<ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-elevated">
					{items.map((x) => (
						<li key={x.id}>
							<button
								type="button"
								onClick={() => setOpen(x)}
								className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover"
							>
								<span className="w-14 shrink-0 text-xs text-fg-3">{relativeTime(x.startedAt)}</span>
								<span className="shrink-0 text-sm font-medium text-fg">
									{name(x.from)} → {name(x.to)}
								</span>
								<Badge variant={STATUS[x.status].variant}>{STATUS[x.status].label}</Badge>
								<span className="min-w-0 flex-1 truncate text-sm text-fg-2">{x.request}</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{open && <ExchangeSheet exchange={open} onClose={() => setOpen(undefined)} name={name} />}
		</section>
	);
}

function ExchangeSheet({
	exchange,
	onClose,
	name,
}: {
	exchange: LinkExchange;
	onClose: () => void;
	name: (id: DotId) => string;
}) {
	const [messages, setMessages] = useState<ChatMessageView[] | undefined>();
	useEffect(() => {
		api.chat
			.linkHistory(exchange.to, exchange.from)
			.then(setMessages)
			.catch(() => setMessages([]));
	}, [exchange.to, exchange.from]);

	return (
		<Sheet open onOpenChange={(o) => !o && onClose()} title={`${name(exchange.from)} → ${name(exchange.to)}`}>
			{!messages ? (
				<Spinner size={20} />
			) : (
				<div className="flex flex-col gap-2">
					{messages.length === 0 && <p className="text-sm text-fg-3">No messages in this conversation yet.</p>}
					{messages.map((m) => {
						const mine = m.role === "link-out" || m.role === "assistant";
						return (
							<div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
								<div
									className={cn(
										"od-selectable max-w-[85%] whitespace-pre-wrap rounded-bubble px-3 py-2 text-sm text-fg shadow-bubble",
										mine ? "bg-bubble-out" : "bg-bubble-link",
									)}
								>
									{m.text}
								</div>
								<span className="mt-0.5 text-2xs text-fg-3">{bubbleTime(m.createdAt)}</span>
							</div>
						);
					})}
				</div>
			)}
		</Sheet>
	);
}
