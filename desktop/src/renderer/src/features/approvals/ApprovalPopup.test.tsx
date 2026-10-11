// @vitest-environment jsdom
import type { ApprovalRequest } from "@shared/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const respond = vi.fn(async (_r: unknown) => undefined);
vi.mock("@/lib/api", () => ({
	api: {
		approvals: { respond: (r: unknown) => respond(r) },
		on: vi.fn(() => () => undefined),
	},
	errorText: String,
}));

import { TooltipProvider } from "@/design-system/components";
import { useApprovals } from "@/stores/approvals";
import { useDots } from "@/stores/dots";
import { ApprovalPopup } from "./ApprovalPopup";

function req(id: string, over: Partial<ApprovalRequest> = {}): ApprovalRequest {
	return {
		id: `apr_${id}` as ApprovalRequest["id"],
		kind: "folder",
		dotId: "dot_design" as ApprovalRequest["dotId"],
		title: `Design needs access to looper ${id}`,
		detail: "Read: /Users/me/looper/app.ts",
		folder: "/Users/me/looper",
		createdAt: new Date().toISOString(),
		...over,
	};
}

const renderAt = (route: Parameters<typeof ApprovalPopup>[0]["route"]) =>
	render(
		<TooltipProvider>
			<ApprovalPopup route={route} />
		</TooltipProvider>,
	);

beforeEach(() => {
	respond.mockClear();
	useDots.setState({ dots: [], statuses: {}, loaded: true });
	useApprovals.setState({ pending: [], history: [], historyLoaded: false });
});
afterEach(cleanup);

describe("ApprovalPopup", () => {
	it("pops up on any screen and answers from the popup", () => {
		renderAt({ name: "organisation" });
		expect(screen.queryByText("Design needs access to looper 1")).toBeNull();
		act(() => useApprovals.setState({ pending: [req("1")] }));
		expect(screen.getByText("Design needs access to looper 1")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Always allow this folder" }));
		expect(respond).toHaveBeenCalledWith({ id: "apr_1", decision: "allow-always" });
	});

	it("stays out of the Approvals screen and the asking Dot's open chat", () => {
		useApprovals.setState({ pending: [req("1")] });
		const { unmount } = renderAt({ name: "approvals" });
		expect(screen.queryByText("Design needs access to looper 1")).toBeNull();
		unmount();
		const chat = renderAt({ name: "chats", dotId: "dot_design" });
		expect(screen.queryByText("Design needs access to looper 1")).toBeNull();
		chat.unmount();
		renderAt({ name: "chats", dotId: "dot_other" });
		expect(screen.getByText("Design needs access to looper 1")).toBeTruthy();
	});

	it("shows the newest two, counts the rest, and hides a card on close", () => {
		useApprovals.setState({ pending: [req("1"), req("2"), req("3")] });
		renderAt({ name: "connections" });
		expect(screen.getByText("Design needs access to looper 3")).toBeTruthy();
		expect(screen.getByText("Design needs access to looper 2")).toBeTruthy();
		expect(screen.queryByText("Design needs access to looper 1")).toBeNull();
		expect(screen.getByText("1 more waiting · Review all")).toBeTruthy();
		fireEvent.click(screen.getAllByRole("button", { name: "Hide" })[0]!);
		expect(screen.getByText("Design needs access to looper 1")).toBeTruthy();
		expect(useApprovals.getState().pending).toHaveLength(3);
	});
});
