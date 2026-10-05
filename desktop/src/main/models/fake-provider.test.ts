import { describe, expect, it } from "vitest";
import { dotNameFromSystemPrompt, pickByDot, systemTextOf } from "./fake-provider";

describe("fake provider byDot steps", () => {
	const prompt = (name: string) =>
		`You are ${name}, one of the user's personal assistants ("Dots") in the OpenDot app.`;

	it("reads the Dot's name from the system prompt", () => {
		expect(dotNameFromSystemPrompt(prompt("Code Buddy"))).toBe("Code Buddy");
		expect(dotNameFromSystemPrompt(undefined)).toBeUndefined();
	});

	it("finds the system text in a context", () => {
		expect(systemTextOf({ systemPrompt: "A" })).toBe("A");
		const ctx = {
			messages: [{ role: "system", content: "", sections: { preamble: prompt("Inbox") } }, { role: "user" }],
		};
		expect(dotNameFromSystemPrompt(systemTextOf(ctx))).toBe("Inbox");
		expect(systemTextOf({ messages: [] })).toBe("");
	});

	it("picks the reply for the asking Dot, regardless of call order", () => {
		const byDot = { Inbox: "inbox reply", Calendar: "calendar reply", "*": "fallback" };
		expect(pickByDot(byDot, prompt("Calendar"))).toBe("calendar reply");
		expect(pickByDot(byDot, prompt("Inbox"))).toBe("inbox reply");
		expect(pickByDot(byDot, prompt("Travel"))).toBe("fallback");
	});
});
