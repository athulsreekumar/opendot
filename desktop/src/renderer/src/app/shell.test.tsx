// @vitest-environment jsdom
import type { Dot } from "@shared/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
	api: {
		dots: {
			list: vi.fn(async () => []),
			update: vi.fn(async () => ({})),
			markRead: vi.fn(async () => undefined),
			remove: vi.fn(async () => undefined),
			duplicate: vi.fn(async () => ({})),
		},
		app: { setUiState: vi.fn(async () => undefined), getUiState: vi.fn(async () => ({})) },
		on: vi.fn(() => () => undefined),
	},
	errorText: String,
}));

import { DotListItem } from "@/features/chats/DotListItem";
import { useDots } from "@/stores/dots";
import { ListPane } from "./ListPane";

function makeDot(over: Partial<Dot> & { id: string; name: string }): Dot {
	return {
		kind: "standard",
		tagline: "",
		appearance: { icon: "mail", color: "teal" },
		lastActivityAt: new Date().toISOString(),
		lastMessagePreview: "",
		unreadCount: 0,
		pinned: false,
		muted: false,
		archived: false,
		...over,
	} as unknown as Dot;
}

beforeEach(() => {
	useDots.setState({ dots: [], statuses: {}, loaded: true });
});
afterEach(cleanup);

describe("DotListItem", () => {
	it("renders name, preview and unread badge", () => {
		const dot = makeDot({ id: "dot_a", name: "Inbox", lastMessagePreview: "Top priority", unreadCount: 2 });
		render(<DotListItem dot={dot} static />);
		expect(screen.getByText("Inbox")).toBeTruthy();
		expect(screen.getByText("Top priority")).toBeTruthy();
		expect(screen.getByText("2")).toBeTruthy();
	});

	it("shows live status instead of the preview", () => {
		const dot = makeDot({ id: "dot_a", name: "Inbox", lastMessagePreview: "Top priority" });
		useDots.setState({ statuses: { dot_a: { kind: "tool", label: "Gmail" } } });
		render(<DotListItem dot={dot} static />);
		expect(screen.getByText("using Gmail…")).toBeTruthy();
		expect(screen.queryByText("Top priority")).toBeNull();
	});
});

describe("ListPane", () => {
	it("filters by search and shows the empty message", async () => {
		useDots.setState({
			dots: [makeDot({ id: "dot_a", name: "Inbox" }), makeDot({ id: "dot_b", name: "Calendar" })],
		});
		render(<ListPane />);
		expect(screen.getByText("Inbox")).toBeTruthy();
		expect(screen.getByText("Calendar")).toBeTruthy();
		const input = screen.getByLabelText("Search Dots");
		await act(async () => {
			fireEvent.change(input, { target: { value: "cal" } });
		});
		expect(screen.queryByText("Inbox")).toBeNull();
		expect(screen.getByText("Calendar")).toBeTruthy();
		await act(async () => {
			fireEvent.change(input, { target: { value: "zzz" } });
		});
		expect(screen.getByText("No Dots match “zzz”")).toBeTruthy();
	});

	it("shows the first-run empty state", () => {
		render(<ListPane />);
		expect(screen.getByText("No Dots yet")).toBeTruthy();
	});
});
