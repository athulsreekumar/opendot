import type { Dot, DotStatus } from "@shared/types";
import { Archive, Bell, CheckCheck, PinOff } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { navigate } from "@/app/router";
import { cn } from "@/design-system/cn";
import {
	Avatar,
	Badge,
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
	toast,
} from "@/design-system/components";
import { IconCopy, IconMute, IconPin, IconTrash } from "@/design-system/icons";
import { errorText } from "@/lib/api";
import { listTime } from "@/lib/format";
import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";

const BUSY_KINDS = new Set<DotStatus["kind"]>([
	"thinking",
	"typing",
	"tool",
	"waiting-approval",
	"talking-to",
	"handling-events",
]);

export function statusText(status: DotStatus | undefined, peerName?: string): string | undefined {
	if (!status) return undefined;
	switch (status.kind) {
		case "thinking":
			return "thinking…";
		case "typing":
			return "typing…";
		case "tool":
			return `using ${status.label}…`;
		case "waiting-approval":
			return "waiting for approval";
		case "talking-to":
			return `talking to ${peerName ?? "another Dot"}…`;
		case "handling-events":
			return "handling events…";
		default:
			return undefined;
	}
}

export interface DotListItemProps {
	dot: Dot;
	selected?: boolean;
	/** Disable layout animation (tests / gallery). */
	static?: boolean;
}

export function DotListItem({ dot, selected = false, static: isStatic = false }: DotListItemProps) {
	const status = useDots((s) => s.statuses[dot.id]);
	const peerName = useDots((s) =>
		status?.kind === "talking-to" ? s.dots.find((d) => d.id === status.peerDotId)?.name : undefined,
	);
	const running = useRuntime((s) => s.health[dot.id]?.state === "running");
	const reduced = useReducedMotion();
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

	const isSuper = dot.kind === "super";
	const live = statusText(status, peerName);
	const busy = status ? BUSY_KINDS.has(status.kind) : false;
	const avatarStatus = status?.kind === "error" ? "error" : busy ? "busy" : running ? "online" : undefined;
	const unread = dot.unreadCount > 0;
	const urgent = dot.lastMessagePreview.startsWith("⚠");

	const open = () => {
		navigate(`#/chats/${dot.id}`);
		void useDots.getState().markRead(dot.id);
	};

	const run = (fn: () => Promise<unknown>) => {
		fn().catch((e) => toast({ title: "Something went wrong", description: errorText(e), variant: "error" }));
	};
	const patch = (p: Parameters<ReturnType<typeof useDots.getState>["update"]>[1]) =>
		run(() => useDots.getState().update(dot.id, p));

	const onDelete = () => {
		if (window.confirm(`Delete “${dot.name}”? Its chat and settings will be removed.`)) {
			run(async () => {
				await useDots.getState().remove(dot.id);
				if (window.location.hash.includes(dot.id)) navigate("#/chats");
			});
		}
	};

	return (
		<motion.div
			layout={isStatic || reduced ? false : "position"}
			transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
			className="relative px-1"
			onContextMenu={(e) => {
				e.preventDefault();
				const rect = e.currentTarget.getBoundingClientRect();
				setMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
			}}
		>
			<button
				type="button"
				onClick={open}
				aria-current={selected ? "true" : undefined}
				className={cn(
					"od-no-drag flex h-[72px] w-full items-center gap-3 rounded-lg px-3 text-left transition-colors",
					isSuper && !selected && "bg-accent-subtle",
					selected ? "bg-selected" : "hover:bg-hover",
				)}
			>
				<Avatar
					size="md"
					name={dot.name}
					icon={dot.appearance.icon}
					color={dot.appearance.color}
					mark={isSuper}
					status={avatarStatus}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="flex items-baseline gap-2">
						<span className="min-w-0 flex-1 truncate text-lg font-semibold text-fg">{dot.name}</span>
						<span className={cn("shrink-0 text-xs", unread ? "text-accent" : "text-fg-3")}>
							{listTime(dot.lastActivityAt)}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"min-w-0 flex-1 truncate text-sm",
								live ? "italic text-accent" : urgent ? "text-warning" : "text-fg-2",
							)}
						>
							{live ?? (dot.lastMessagePreview || dot.tagline)}
						</span>
						{dot.muted && <IconMute size={12} className="shrink-0 text-fg-3" aria-label="Muted" />}
						{dot.pinned && !isSuper && <IconPin size={12} className="shrink-0 text-fg-3" aria-label="Pinned" />}
						{unread && <Badge variant="unread" count={dot.unreadCount} className="shrink-0" />}
					</div>
				</div>
			</button>
			<Menu open={menu !== null} onOpenChange={(o) => !o && setMenu(null)}>
				<MenuTrigger asChild>
					<span
						aria-hidden
						className="pointer-events-none absolute h-0 w-0"
						style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
					/>
				</MenuTrigger>
				<MenuContent align="start" sideOffset={4}>
					{!isSuper && (
						<MenuItem
							icon={dot.pinned ? <PinOff size={16} /> : <IconPin size={16} />}
							onSelect={() => patch({ pinned: !dot.pinned })}
						>
							{dot.pinned ? "Unpin" : "Pin"}
						</MenuItem>
					)}
					{!isSuper && (
						<MenuItem
							icon={dot.muted ? <Bell size={16} /> : <IconMute size={16} />}
							onSelect={() => patch({ muted: !dot.muted })}
						>
							{dot.muted ? "Unmute" : "Mute"}
						</MenuItem>
					)}
					<MenuItem icon={<CheckCheck size={16} />} onSelect={() => run(() => useDots.getState().markRead(dot.id))}>
						Mark read
					</MenuItem>
					{!isSuper && (
						<>
							<MenuItem icon={<IconCopy size={16} />} onSelect={() => run(() => useDots.getState().duplicate(dot.id))}>
								Duplicate
							</MenuItem>
							<MenuItem icon={<Archive size={16} />} onSelect={() => patch({ archived: !dot.archived })}>
								{dot.archived ? "Unarchive" : "Archive"}
							</MenuItem>
							<MenuSeparator />
							<MenuItem destructive icon={<IconTrash size={16} />} onSelect={onDelete}>
								Delete
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
		</motion.div>
	);
}
