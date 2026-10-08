// @vitest-environment jsdom
import type { Dot, ToolCallView } from "@shared/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
	api: { app: { openExternal: vi.fn() }, chat: { send: vi.fn(), abort: vi.fn() }, dots: {} },
	errorText: (e: unknown) => String(e),
}));

const renders = vi.hoisted(() => ({ texts: [] as string[] }));
vi.mock("./Markdown", () => ({
	Markdown: ({ text }: { text: string }) => {
		renders.texts.push(text);
		return <div data-testid="md">{text}</div>;
	},
	CodeBlock: ({ code, lang }: { code: string; lang?: string }) => (
		<pre data-testid="code" data-lang={lang}>
			{code}
		</pre>
	),
}));

import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useSettings } from "../../stores/settings";
import { useUi } from "../../stores/ui";
import { Composer } from "./Composer";
import { StreamingMarkdown, splitBlocks } from "./StreamingMarkdown";
import { ToolCallChip } from "./ToolCallChip";

afterEach(() => {
	cleanup();
	renders.texts.length = 0;
});

describe("StreamingMarkdown", () => {
	it("splits at blank lines outside fences", () => {
		const b = splitBlocks("a\n\nb\n```js\nx\n\ny\n```\n\nc");
		expect(b.map((x) => x.text)).toEqual(["a", "b\n```js\nx\n\ny\n```", "c"]);
		expect(b.every((x) => !x.open)).toBe(true);
	});

	it("memoises completed blocks: only the tail re-parses", () => {
		const { rerender } = render(<StreamingMarkdown text={"one\n\ntwo\n\nthr"} streaming />);
		expect(renders.texts).toEqual(["one", "two", "thr"]);
		renders.texts.length = 0;
		rerender(<StreamingMarkdown text={"one\n\ntwo\n\nthree"} streaming />);
		expect(renders.texts).toEqual(["three"]);
	});

	it("renders an unclosed fence as a plain code block", () => {
		render(<StreamingMarkdown text={"intro\n\n```ts\nconst a = 1;\n\nconst b"} streaming />);
		const code = screen.getByTestId("code");
		expect(code.getAttribute("data-lang")).toBe("ts");
		expect(code.textContent).toBe("const a = 1;\n\nconst b");
		expect(screen.getAllByTestId("md")).toHaveLength(1);
	});

	it("reports first paint once when text appears", () => {
		const reportPaint = vi.fn();
		(window as unknown as { opendotTest: unknown }).opendotTest = { reportPaint };
		const { rerender } = render(<StreamingMarkdown text="" streaming messageId="m1" />);
		expect(reportPaint).not.toHaveBeenCalled();
		rerender(<StreamingMarkdown text="Hi" streaming messageId="m1" />);
		rerender(<StreamingMarkdown text="Hi there" streaming messageId="m1" />);
		expect(reportPaint).toHaveBeenCalledTimes(1);
		(window as unknown as { opendotTest?: unknown }).opendotTest = undefined;
	});
});

describe("Composer", () => {
	const dot = {
		id: "dot_1",
		name: "Inbox",
		kind: "standard",
		hiddenFromSuper: false,
		appearance: { color: "teal", icon: "message" },
	} as unknown as Dot;
	const send = vi.fn();
	beforeEach(() => {
		send.mockReset();
		useChat.setState({ send, byDot: {} });
		useDots.setState({ dots: [dot], statuses: {} });
		useSettings.setState({
			models: [
				{
					providerId: "p",
					modelId: "m",
					label: "M",
					providerLabel: "P",
					isLocal: false,
					vision: false,
					reasoning: false,
				},
			],
		});
		useUi.setState({ drafts: {} });
	});

	it("Enter sends and clears the draft", () => {
		render(<Composer dotId="dot_1" />);
		const ta = screen.getByPlaceholderText("Message Inbox");
		fireEvent.change(ta, { target: { value: "hello" } });
		fireEvent.keyDown(ta, { key: "Enter" });
		expect(send).toHaveBeenCalledWith("dot_1", "hello", "auto");
		expect(useUi.getState().drafts.dot_1).toBe("");
	});

	it("Shift+Enter does not send", () => {
		render(<Composer dotId="dot_1" />);
		const ta = screen.getByPlaceholderText("Message Inbox");
		fireEvent.change(ta, { target: { value: "hello" } });
		fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
		expect(send).not.toHaveBeenCalled();
	});
});

describe("ToolCallChip", () => {
	it("shows the streamed argsPreview while preparing", () => {
		const tool: ToolCallView = {
			id: "t1",
			name: "gmail_search",
			label: "search",
			connectionLabel: "Gmail",
			args: {},
			argsPreview: '{"query":"invoi',
			status: "preparing",
			startedAt: new Date().toISOString(),
		};
		render(<ToolCallChip tool={tool} />);
		expect(screen.getByText('{"query":"invoi')).toBeTruthy();
		expect(screen.getByText("Gmail · search")).toBeTruthy();
	});
});
