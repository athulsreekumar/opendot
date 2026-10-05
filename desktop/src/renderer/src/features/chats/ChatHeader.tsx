import type { ChatMessageView, Dot, DotId, DotStatus } from "@shared/types";
import { useState } from "react";
import { navigate } from "../../app/router";
import { cn } from "../../design-system/cn";
import {
	Avatar,
	Button,
	Dialog,
	DialogFooter,
	IconButton,
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
	toast,
} from "../../design-system/components";
import { IconCopy, IconInfo, IconMore, IconMute, IconPin, IconTrash, IconWarning } from "../../design-system/icons";
import { errorText } from "../../lib/api";
import { bubbleTime } from "../../lib/format";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useRuntime } from "../../stores/runtime";
import { useSettings } from "../../stores/settings";
import { useUi } from "../../stores/ui";
import { PiiBadge, useDotModelLocal } from "./PiiBadge";

function statusLine(
	status: DotStatus | undefined,
	nameOf: (id: string) => string,
): { text?: string; tone: "live" | "error" | "idle" } {
	switch (status?.kind) {
		case "thinking":
			return { text: "thinking…", tone: "live" };
		case "typing":
			return { text: "typing…", tone: "live" };
		case "tool":
			return { text: `using ${status.label}…`, tone: "live" };
		case "waiting-approval":
			return { text: "waiting for your approval", tone: "live" };
		case "talking-to":
			return { text: `talking to ${nameOf(status.peerDotId)}…`, tone: "live" };
		case "handling-events":
			return { text: `reading ${status.count} new ${status.count === 1 ? "event" : "events"}…`, tone: "live" };
		case "queued":
			return { text: "queued…", tone: "live" };
		case "error":
			return { text: status.message, tone: "error" };
		default:
			return { tone: "idle" };
	}
}

export function chatAsMarkdown(dot: Dot, messages: ChatMessageView[]): string {
	const lines = [`# Chat with ${dot.name}`, ""];
	for (const m of messages) {
		if (m.role === "event") {
			lines.push(`> Events: ${(m.events ?? []).map((e) => e.title).join("; ")}`, "");
			continue;
		}
		const who = m.role === "user" ? "You" : m.role === "assistant" ? dot.name : m.role;
		lines.push(`**${who}** (${bubbleTime(m.createdAt)})`, "", m.text, "");
	}
	return lines.join("\n");
}

export function ClearChatDialog({
	dotId,
	open,
	onOpenChange,
}: {
	dotId: DotId;
	open: boolean;
	onOpenChange: (o: boolean) => void;
}) {
	const [busy, setBusy] = useState(false);
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			size="sm"
			title="Clear this chat?"
			description="This removes the messages in this chat. The Dot keeps its personality and memory."
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						loading={busy}
						onClick={async () => {
							setBusy(true);
							try {
								await useChat.getState().clear(dotId);
								onOpenChange(false);
							} catch (e) {
								toast({ title: "Couldn't clear the chat", description: errorText(e), variant: "error" });
							} finally {
								setBusy(false);
							}
						}}
					>
						Clear chat
					</Button>
				</DialogFooter>
			}
		>
			<span className="sr-only">Clear chat confirmation</span>
		</Dialog>
	);
}

export function ChatHeader({ dot }: { dot: Dot }) {
	const status = useDots((s) => s.statuses[dot.id]);
	const dots = useDots((s) => s.dots);
	const models = useSettings((s) => s.models);
	const local = useDotModelLocal(dot);
	const connStatus = useRuntime((s) => s.connectionStatus);
	const toggleDrawer = useUi((s) => s.toggleDrawer);
	const [clearOpen, setClearOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const line = statusLine(status, (id) => dots.find((d) => d.id === id)?.name ?? "a Dot");
	const modelLabel = dot.model
		? (models.find((m) => m.providerId === dot.model?.providerId && m.modelId === dot.model?.modelId)?.label ??
			dot.model.modelId)
		: "Default";
	const hasConnError = dot.grants.some((g) => connStatus[g.connectionId]?.state === "error");
	const isSuper = dot.kind === "super";

	const copyMarkdown = () => {
		const md = chatAsMarkdown(dot, useChat.getState().messages(dot.id));
		void navigator.clipboard.writeText(md).then(
			() => toast({ title: "Chat copied as Markdown", variant: "success" }),
			(e) => toast({ title: "Couldn't copy", description: errorText(e), variant: "error" }),
		);
	};
	const patch = (p: { muted?: boolean; pinned?: boolean }) =>
		void useDots
			.getState()
			.update(dot.id, p)
			.catch((e) => toast({ title: "Couldn't update this Dot", description: errorText(e), variant: "error" }));

	return (
		<header className="flex h-[var(--od-header-h)] shrink-0 items-center gap-3 border-b border-border-subtle bg-sidebar px-4">
			<Avatar size="md" color={dot.appearance.color} emoji={dot.appearance.emoji} name={dot.name} mark={isSuper} />
			<div className="min-w-0 flex-1">
				<div className="truncate text-lg font-semibold text-fg">{dot.name}</div>
				<div
					className={cn(
						"truncate text-xs",
						line.tone === "live" && "italic text-accent",
						line.tone === "error" && "text-danger",
						line.tone === "idle" && "text-fg-3",
					)}
					aria-live="polite"
				>
					{line.text ?? dot.tagline}
				</div>
			</div>
			<span className="hidden h-7 max-w-[200px] items-center gap-1 truncate rounded-full bg-sunken px-2.5 text-xs text-fg-2 sm:flex">
				<span className="truncate">{modelLabel}</span>
				{local && <span className="shrink-0">local 🔒</span>}
			</span>
			<PiiBadge dot={dot} />
			{hasConnError && (
				<button
					type="button"
					onClick={() => navigate("#/connections")}
					className="flex h-7 items-center gap-1 rounded-full bg-warning-subtle px-2 text-xs text-warning"
					aria-label="A connection has a problem. Open connections"
				>
					<IconWarning size={14} />
					Connection issue
				</button>
			)}
			<IconButton label="Dot info" icon={<IconInfo size={18} />} onClick={toggleDrawer} />
			<Menu>
				<MenuTrigger asChild>
					<IconButton label="More" icon={<IconMore size={18} />} />
				</MenuTrigger>
				<MenuContent align="end">
					<MenuItem onSelect={() => setClearOpen(true)}>Clear chat</MenuItem>
					<MenuItem icon={<IconCopy size={14} />} onSelect={copyMarkdown}>
						Copy chat as Markdown
					</MenuItem>
					<MenuSeparator />
					<MenuItem icon={<IconMute size={14} />} onSelect={() => patch({ muted: !dot.muted })}>
						{dot.muted ? "Unmute" : "Mute"}
					</MenuItem>
					<MenuItem icon={<IconPin size={14} />} onSelect={() => patch({ pinned: !dot.pinned })}>
						{dot.pinned ? "Unpin" : "Pin"}
					</MenuItem>
					{!isSuper && (
						<>
							<MenuSeparator />
							<MenuItem destructive icon={<IconTrash size={14} />} onSelect={() => setDeleteOpen(true)}>
								Delete
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<ClearChatDialog dotId={dot.id} open={clearOpen} onOpenChange={setClearOpen} />
			<Dialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				size="sm"
				title={`Delete ${dot.name}?`}
				description="This removes the Dot, its chat and its memory. It can't be undone."
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={async () => {
								try {
									await useDots.getState().remove(dot.id);
									setDeleteOpen(false);
									navigate("#/chats");
								} catch (e) {
									toast({ title: "Couldn't delete this Dot", description: errorText(e), variant: "error" });
								}
							}}
						>
							Delete
						</Button>
					</DialogFooter>
				}
			>
				<span className="sr-only">Delete confirmation</span>
			</Dialog>
		</header>
	);
}
