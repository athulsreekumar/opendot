import type { ChatMessageView } from "@shared/types";
import { describe, expect, it } from "vitest";
import { selectAnswer } from "./answer";

const msg = (id: string, role: ChatMessageView["role"], text: string, extra: Partial<ChatMessageView> = {}) =>
	({
		id,
		dotId: "dot_a000001",
		role,
		text,
		toolCalls: [],
		createdAt: "2026-01-01T00:00:00.000Z",
		streaming: false,
		...extra,
	}) as ChatMessageView;

describe("selectAnswer", () => {
	it("is empty until the question shows up", () => {
		expect(selectAnswer([], "hi")).toMatchObject({ asked: false, text: "" });
		expect(selectAnswer([msg("1", "user", "other")], "hi").asked).toBe(false);
	});
	it("waits for the first reply", () => {
		expect(selectAnswer([msg("1", "user", "hi")], "hi")).toMatchObject({ asked: true, text: "", streaming: false });
	});
	it("streams the reply that follows the question", () => {
		const a = selectAnswer([msg("1", "user", "hi"), msg("2", "assistant", "You said", { streaming: true })], " hi ");
		expect(a).toMatchObject({ text: "You said", streaming: true, messageId: "2" });
	});
	it("ignores older conversation and takes the newest matching question", () => {
		const a = selectAnswer(
			[msg("1", "user", "hi"), msg("2", "assistant", "old"), msg("3", "user", "hi"), msg("4", "assistant", "new")],
			"hi",
		);
		expect(a.text).toBe("new");
	});
	it("shows only the last reply of a tool-using turn", () => {
		const a = selectAnswer(
			[msg("1", "user", "q"), msg("2", "assistant", "Let me check."), msg("3", "assistant", "Final answer")],
			"q",
		);
		expect(a.text).toBe("Final answer");
	});
	it("keeps streaming true while a later empty message is still open", () => {
		const a = selectAnswer(
			[msg("1", "user", "q"), msg("2", "assistant", "Checking"), msg("3", "assistant", "", { streaming: true })],
			"q",
		);
		expect(a).toMatchObject({ text: "Checking", streaming: true });
	});
	it("surfaces errors", () => {
		expect(
			selectAnswer([msg("1", "user", "q"), msg("2", "assistant", "", { error: "401 Unauthorized" })], "q").error,
		).toBe("401 Unauthorized");
		expect(selectAnswer([msg("1", "user", "q", { error: "offline" })], "q").sendError).toBe("offline");
	});
	it("skips hidden and non-assistant messages", () => {
		const a = selectAnswer(
			[
				msg("1", "user", "q"),
				msg("2", "assistant", "secret", { hidden: true }),
				msg("3", "system", "note"),
				msg("4", "assistant", "visible"),
			],
			"q",
		);
		expect(a.text).toBe("visible");
	});
});
