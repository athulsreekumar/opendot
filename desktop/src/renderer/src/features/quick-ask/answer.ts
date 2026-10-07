// Picks the answer to one quick-ask question out of a Dot's chat messages.
import type { ChatMessageView } from "@shared/types";

export interface QuickAnswer {
	text: string;
	streaming: boolean;
	error?: string;
	/** The question never reached the Dot. */
	sendError?: string;
	messageId?: string;
	/** Whether the question itself has shown up in the chat yet. */
	asked: boolean;
}

/**
 * The reply is the last visible assistant message after the question. Earlier ones in the same turn are tool-call
 * preambles ("Let me check…"), so they are left out of this compact view (the chat history keeps all of them).
 */
export function selectAnswer(messages: ChatMessageView[], question: string): QuickAnswer {
	const q = question.trim();
	let at = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i]!;
		if (m.role === "user" && m.text.trim() === q) {
			at = i;
			break;
		}
	}
	if (at < 0) return { text: "", streaming: false, asked: false };
	const asked = messages[at]!;
	if (asked.error) return { text: "", streaming: false, asked: true, sendError: asked.error };
	const replies = messages.slice(at + 1).filter((m) => m.role === "assistant" && !m.hidden);
	const streaming = replies.some((m) => m.streaming);
	let chosen: ChatMessageView | undefined;
	for (let i = replies.length - 1; i >= 0; i--) {
		const m = replies[i]!;
		if (m.text.trim() || m.error) {
			chosen = m;
			break;
		}
	}
	return {
		text: chosen?.text ?? "",
		streaming,
		error: chosen?.error,
		messageId: chosen?.id,
		asked: true,
	};
}
