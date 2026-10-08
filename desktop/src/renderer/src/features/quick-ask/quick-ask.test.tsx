// @vitest-environment jsdom
import type { ApprovalRequest, Dot } from "@shared/types";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/api", () => ({
	errorText: (e: unknown) => String(e),
	api: {
		on: vi.fn(() => () => undefined),
		app: { openExternal: vi.fn() },
		approvals: { respond: vi.fn(async () => undefined) },
		chat: { send: vi.fn(async () => ({ accepted: true })), abort: vi.fn() },
		quickAsk: {
			resize: vi.fn(async () => undefined),
			hide: vi.fn(async () => undefined),
			openInApp: vi.fn(async () => undefined),
			report: vi.fn(async () => undefined),
			status: vi.fn(),
		},
	},
}));
vi.mock("../chats/StreamingMarkdown", () => ({
	StreamingMarkdown: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

import { api } from "@/lib/api";
import { useApprovals } from "../../stores/approvals";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useSettings } from "../../stores/settings";
import { QuickApproval } from "./QuickApproval";
import { QuickAsk } from "./QuickAsk";

const dot = (id: string, name: string, kind: "super" | "standard" = "standard") =>
	({
		id,
		name,
		kind,
		tagline: "",
		archived: false,
		appearance: { icon: "user", color: "teal" },
	}) as unknown as Dot;

beforeEach(() => {
	class RO {
		observe() {}
		disconnect() {}
		unobserve() {}
	}
	(window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
	useDots.setState({
		dots: [dot("dot_super01", "SuperDot", "super"), dot("dot_inbox01", "Inbox"), dot("dot_cal0001", "Calendar")],
		statuses: {},
	});
	useSettings.setState({ settings: { defaultModel: { providerId: "p", modelId: "m" } } as never, models: [] });
	useChat.setState({ byDot: {} });
	useChat.setState({ send: send as never });
	useApprovals.setState({ pending: [] });
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("QuickAsk", () => {
	it("shows the Dots when typing @ and picks one with the keyboard", async () => {
		render(<QuickAsk />);
		const input = screen.getByPlaceholderText("Ask SuperDot, or @ a Dot") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "@", selectionStart: 1 } });
		expect(await screen.findByRole("listbox", { name: "Mention a Dot" })).toBeTruthy();
		expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Inbox", "Calendar"]);
		fireEvent.keyDown(input, { key: "ArrowDown" });
		fireEvent.keyDown(input, { key: "Enter" });
		await waitFor(() => expect(input.value).toBe("@Calendar "));
		expect(send).not.toHaveBeenCalled();
	});

	it("sends a plain question to SuperDot", async () => {
		render(<QuickAsk />);
		const input = screen.getByPlaceholderText("Ask SuperDot, or @ a Dot");
		fireEvent.change(input, { target: { value: "what is new?" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(send).toHaveBeenCalledWith("dot_super01", "what is new?");
	});

	it("sends @Name questions to that Dot only, without the mention", async () => {
		render(<QuickAsk />);
		const input = screen.getByPlaceholderText("Ask SuperDot, or @ a Dot");
		fireEvent.change(input, { target: { value: "@Inbox anything urgent?" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(send).toHaveBeenCalledWith("dot_inbox01", "anything urgent?");
	});

	it("shows the streamed answer with actions", async () => {
		render(<QuickAsk />);
		const input = screen.getByPlaceholderText("Ask SuperDot, or @ a Dot");
		fireEvent.change(input, { target: { value: "hi" } });
		fireEvent.keyDown(input, { key: "Enter" });
		act(() => {
			useChat.setState({
				byDot: {
					dot_super01: {
						byId: {
							u1: {
								id: "u1",
								dotId: "dot_super01",
								role: "user",
								text: "hi",
								toolCalls: [],
								createdAt: "",
								streaming: false,
							},
							a1: {
								id: "a1",
								dotId: "dot_super01",
								role: "assistant",
								text: "You said: hi",
								toolCalls: [],
								createdAt: "",
								streaming: true,
							},
						},
						order: ["u1", "a1"],
						hasMore: false,
						loading: false,
						loaded: true,
						seq: {},
						needsResync: {},
						pendingNonces: {},
					},
				},
			});
		});
		expect((await screen.findByTestId("md")).textContent).toBe("You said: hi");
		fireEvent.click(screen.getByRole("button", { name: /open in opendot/i }));
		expect(api.quickAsk.openInApp).toHaveBeenCalledWith("dot_super01");
		expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
	});

	it("hides on Escape and opens the chat on Ctrl+Enter", async () => {
		render(<QuickAsk />);
		fireEvent.keyDown(window, { key: "Escape" });
		expect(api.quickAsk.hide).toHaveBeenCalled();
		const input = screen.getByPlaceholderText("Ask SuperDot, or @ a Dot");
		fireEvent.change(input, { target: { value: "hello" } });
		fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
		expect(send).toHaveBeenCalledWith("dot_super01", "hello");
	});
});

describe("QuickApproval", () => {
	const approval = {
		id: "apr_1",
		kind: "tool",
		dotId: "dot_inbox01",
		title: "Delete everything?",
		detail: "",
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 60_000).toISOString(),
	} as unknown as ApprovalRequest;

	it("asks inline and answers through the approvals store", async () => {
		render(<QuickApproval approval={approval} />);
		expect(screen.getByText("Needs your approval")).toBeTruthy();
		expect(screen.getByText("Delete everything?")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
		await waitFor(() => expect(api.approvals.respond).toHaveBeenCalledWith({ id: "apr_1", decision: "allow-once" }));
	});

	it("can deny", async () => {
		render(<QuickApproval approval={approval} />);
		fireEvent.click(screen.getByRole("button", { name: "Deny" }));
		await waitFor(() => expect(api.approvals.respond).toHaveBeenCalledWith({ id: "apr_1", decision: "deny" }));
	});
});
