import type { DotId } from "@shared/types";
import { useEffect, useRef } from "react";
import { EmptyState } from "../../design-system/components";
import { IconChats } from "../../design-system/icons";
import { api } from "../../lib/api";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useUi } from "../../stores/ui";
import { ApprovalStack } from "./ApprovalCard";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

export function ChatView({ dotId }: { dotId: DotId }) {
	const dot = useDots((s) => s.byId(dotId));
	const focused = useUi((s) => s.focused);
	const unread = dot?.unreadCount ?? 0;
	const wasFocused = useRef(focused);

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
		<section className="flex h-full min-w-0 flex-1 flex-col bg-chat" aria-label={`Chat with ${dot.name}`}>
			<ChatHeader dot={dot} />
			<MessageList key={dotId} dotId={dotId} />
			<ApprovalStack dotId={dotId} />
			<Composer dotId={dotId} />
		</section>
	);
}
