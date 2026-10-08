import type { ChatMessageView, Dot, ToolCallView } from "@shared/types";
import { useState } from "react";
import { navigate } from "../../app/router";
import { cn } from "../../design-system/cn";
import { Avatar, Spinner } from "../../design-system/components";
import { dotColorVars } from "../../design-system/dot-colors";
import { IconCheck, IconClock, IconError, IconWarning } from "../../design-system/icons";
import { useDots } from "../../stores/dots";
import { Markdown } from "./Markdown";
import { argString } from "./ToolCallChip";

function findDot(dots: Dot[], key?: string): Dot | undefined {
	if (!key) return undefined;
	const k = key.toLowerCase();
	return dots.find((d) => d.id === key || d.name.toLowerCase() === k);
}

interface CardProps {
	peer?: Dot;
	peerName: string;
	verb: string;
	request: string;
	reply?: string;
	state: { kind: "wait" | "talk" | "ok" | "blocked" | "error"; label: string };
}

function Card({ peer, peerName, verb, request, reply, state }: CardProps) {
	const [open, setOpen] = useState(false);
	return (
		<div
			style={peer ? dotColorVars(peer.appearance.color) : undefined}
			className="my-1 min-w-[260px] rounded-lg bg-bubble-link p-2.5"
		>
			<div className="flex items-center gap-2 text-sm">
				{peer ? (
					<Avatar
						size="xs"
						color={peer.appearance.color}
						icon={peer.appearance.icon}
						name={peer.name}
						mark={peer.kind === "super"}
					/>
				) : null}
				<span className="min-w-0 flex-1 truncate">
					{verb} <strong className="font-semibold">{peerName}</strong>
				</span>
				<span
					className={cn(
						"flex shrink-0 items-center gap-1 text-2xs",
						state.kind === "blocked" || state.kind === "error"
							? "text-danger"
							: state.kind === "ok"
								? "text-success"
								: "text-fg-3",
					)}
				>
					{state.kind === "talk" && <Spinner size={16} />}
					{state.kind === "wait" && <IconClock size={12} />}
					{state.kind === "ok" && <IconCheck size={12} />}
					{state.kind === "blocked" && <IconError size={12} />}
					{state.kind === "error" && <IconWarning size={12} />}
					{state.label}
				</span>
			</div>
			{request && (
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					aria-expanded={open}
					className={cn("od-selectable mt-1.5 block w-full text-left text-sm text-fg-2", !open && "line-clamp-2")}
				>
					{request}
				</button>
			)}
			{reply ? (
				<div className="mt-1.5 border-l-2 border-[var(--dot,var(--od-border))] pl-2.5">
					<Markdown text={reply} />
				</div>
			) : null}
			{peer && (
				<button
					type="button"
					onClick={() => navigate(`#/chats/${peer.id}`)}
					className="mt-1.5 text-2xs text-fg-3 transition-colors hover:text-fg-2"
				>
					Open {peer.name}
				</button>
			)}
		</div>
	);
}

/** message_dot tool call (A asks B) rendered inside A's bubble. */
export function LinkCard({ tool }: { tool: ToolCallView }) {
	const dots = useDots((s) => s.dots);
	const to = argString(tool, "to");
	const peer = findDot(dots, to);
	const request = argString(tool, "message") ?? "";
	const state: CardProps["state"] =
		tool.status === "pending-approval"
			? { kind: "wait", label: "Waiting for approval" }
			: tool.status === "blocked"
				? { kind: "blocked", label: "Blocked" }
				: tool.status === "error"
					? { kind: "error", label: "No reply" }
					: tool.status === "done"
						? { kind: "ok", label: "Replied" }
						: { kind: "talk", label: tool.status === "preparing" ? "Preparing…" : "Talking…" };
	const reply =
		tool.status === "done" || tool.status === "blocked" || tool.status === "error" ? tool.resultPreview : undefined;
	return (
		<Card
			peer={peer}
			peerName={peer?.name ?? to ?? "a Dot"}
			verb="Asked"
			request={request}
			reply={reply}
			state={state}
		/>
	);
}

/** link-in / link-out timeline card: text = the request, thinking = the reply. */
export function LinkExchangeCard({ message }: { message: ChatMessageView }) {
	const dots = useDots((s) => s.dots);
	const peer = findDot(dots, message.peerDotId);
	const incoming = message.role === "link-in";
	const reply = message.thinking;
	const state: CardProps["state"] = message.error
		? { kind: "error", label: "No reply" }
		: message.streaming && !reply
			? { kind: "talk", label: "Replying…" }
			: reply
				? { kind: "ok", label: "Replied" }
				: { kind: "wait", label: "Waiting" };
	return (
		<Card
			peer={peer}
			peerName={peer?.name ?? "a Dot"}
			verb={incoming ? "Message from" : "You asked"}
			request={message.text}
			reply={reply}
			state={state}
		/>
	);
}
