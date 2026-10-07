import type { DotId } from "@shared/types";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../../design-system/components";
import { IconChats } from "../../design-system/icons";
import { api } from "../../lib/api";
import { incomingFromDrop, useAttachments } from "../../stores/attachments";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useUi } from "../../stores/ui";
import { ApprovalStack } from "./ApprovalCard";
import { DropOverlay } from "./Attachments";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

export function ChatView({ dotId }: { dotId: DotId }) {
	const dot = useDots((s) => s.byId(dotId));
	const focused = useUi((s) => s.focused);
	const unread = dot?.unreadCount ?? 0;
	const wasFocused = useRef(focused);
	const [dragging, setDragging] = useState(false);
	const dragDepth = useRef(0);

	// A file dropped outside a drop target would navigate the window to it; never allow that.
	useEffect(() => {
		const stop = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
		};
		window.addEventListener("dragover", stop);
		window.addEventListener("drop", stop);
		return () => {
			window.removeEventListener("dragover", stop);
			window.removeEventListener("drop", stop);
		};
	}, []);

	useEffect(() => {
		void useChat.getState().loadHistory(dotId);
		void useDots.getState().markRead(dotId);
		void api.app.setUiState({ selectedDotId: dotId }).catch(() => undefined);
		return () => void api.app.setUiState({ selectedDotId: undefined }).catch(() => undefined);
	}, [dotId]);

	// Re-baseline after the window was hidden (renderers are throttled in the background).
	useEffect(() => {
		if (focused && !wasFocused.current) void useChat.getState().loadHistory(dotId, true);
		wasFocused.current = focused;
	}, [focused, dotId]);

	// Messages that arrive while the chat is open count as read.
	useEffect(() => {
		if (unread > 0 && focused) void useDots.getState().markRead(dotId);
	}, [unread, focused, dotId]);

	if (!dot)
		return (
			<EmptyState
				icon={<IconChats size={40} />}
				title="This Dot isn't available"
				body="It may have been deleted. Pick another chat from the list."
			/>
		);

	return (
		<section
			className="relative flex h-full min-w-0 flex-1 flex-col bg-chat"
			aria-label={`Chat with ${dot.name}`}
			onDragEnter={(e) => {
				if (!e.dataTransfer.types.includes("Files")) return;
				dragDepth.current++;
				setDragging(true);
			}}
			onDragOver={(e) => {
				if (!e.dataTransfer.types.includes("Files")) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "copy";
			}}
			onDragLeave={(e) => {
				if (!e.dataTransfer.types.includes("Files")) return;
				dragDepth.current = Math.max(0, dragDepth.current - 1);
				if (dragDepth.current === 0) setDragging(false);
			}}
			onDrop={(e) => {
				if (!e.dataTransfer.types.includes("Files")) return;
				e.preventDefault();
				dragDepth.current = 0;
				setDragging(false);
				// Read entries synchronously: the DataTransfer is cleared after the handler returns.
				void useAttachments.getState().addFiles(dotId, incomingFromDrop(e.dataTransfer));
			}}
		>
			{dragging && <DropOverlay />}
			<ChatHeader dot={dot} />
			<MessageList key={dotId} dotId={dotId} />
			<ApprovalStack dotId={dotId} />
			<Composer dotId={dotId} />
		</section>
	);
}
