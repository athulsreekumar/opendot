// @vitest-environment jsdom
import type { ApprovalRequest } from "@shared/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const respond = vi.fn(async (_r: unknown) => undefined);
const denyAll = vi.fn(async (_d: string, _r?: string) => 2);
vi.mock("@/lib/api", () => ({
	api: {
		approvals: {
			pending: vi.fn(async () => []),
			history: vi.fn(async () => []),
			respond: (r: unknown) => respond(r),
			denyAll: (d: string, r?: string) => denyAll(d, r),
		},
		on: vi.fn(() => () => undefined),
	},
	errorText: String,
}));

import { useApprovals } from "@/stores/approvals";
import { useDots } from "@/stores/dots";
import { ApprovalsScreen, groupByDot } from "./ApprovalsScreen";

function req(id: string, over: Partial<ApprovalRequest> = {}): ApprovalRequest {
	return {
		id: `apr_${id}` as ApprovalRequest["id"],
		kind: "tool",
		dotId: "dot_a" as ApprovalRequest["dotId"],
		title: "Inbox wants to send an email",
		detail: "",
		toolName: "mcp__gmail__send_message",
		args: { to: "jane@example.com", subject: "Lunch", body: "Noon?" },
		why: "You asked me to book lunch.",
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 300_000).toISOString(),
		...over,
	};
}

beforeEach(() => {
	respond.mockClear();
	denyAll.mockClear();
	useDots.setState({ dots: [], statuses: {}, loaded: true });
	useApprovals.setState({ pending: [], history: [], historyLoaded: false });
});
afterEach(cleanup);

describe("ApprovalsScreen", () => {
	it("shows who, what, why and readable details", () => {
		useApprovals.setState({ pending: [req("1")] });
		render(<ApprovalsScreen />);
		expect(screen.getByText("Inbox wants to send an email")).toBeTruthy();
		expect(screen.getByText("You asked me to book lunch.")).toBeTruthy();
		expect(screen.getByText("jane@example.com")).toBeTruthy();
		expect(screen.getByText("Lunch")).toBeTruthy();
		expect(screen.getByText("Waiting (1)")).toBeTruthy();
	});

	it("keyboard: A allows, D denies", () => {
		useApprovals.setState({ pending: [req("1")] });
		render(<ApprovalsScreen />);
		const card = screen.getByRole("group", { name: "Inbox wants to send an email" });
		fireEvent.keyDown(card, { key: "a" });
		expect(respond).toHaveBeenCalledWith({ id: "apr_1", decision: "allow-once" });
		act(() => useApprovals.setState({ pending: [req("2")] }));
		fireEvent.keyDown(screen.getByRole("group"), { key: "d" });
		expect(respond).toHaveBeenLastCalledWith({ id: "apr_2", decision: "deny" });
	});

	it("keyboard: E edits, and the edited fields are sent", () => {
		useApprovals.setState({ pending: [req("1")] });
		render(<ApprovalsScreen />);
		fireEvent.keyDown(screen.getByRole("group"), { key: "e" });
		const subject = screen.getByLabelText("Subject") as HTMLInputElement;
		fireEvent.change(subject, { target: { value: "Dinner" } });
		// Typing letters in a field must not trigger shortcuts.
		fireEvent.keyDown(subject, { key: "a" });
		expect(respond).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: /allow with my changes/i }));
		expect(respond).toHaveBeenCalledWith({
			id: "apr_1",
			decision: "allow-once",
			editedArgs: { to: "jane@example.com", subject: "Dinner", body: "Noon?" },
		});
	});

	it("deny with a reason passes the reason", () => {
		useApprovals.setState({ pending: [req("1")] });
		render(<ApprovalsScreen />);
		fireEvent.click(screen.getByRole("button", { name: /deny with a reason/i }));
		fireEvent.change(screen.getByLabelText("Reason for denying"), { target: { value: "Ask me first" } });
		fireEvent.keyDown(screen.getByLabelText("Reason for denying"), { key: "Enter" });
		expect(respond).toHaveBeenCalledWith({ id: "apr_1", decision: "deny", reason: "Ask me first" });
	});

	it("offers no edit or always-allow where they do not apply", () => {
		useApprovals.setState({
			pending: [req("1", { toolName: "mcp__echo__delete_everything", args: {}, alwaysAllowable: false })],
		});
		render(<ApprovalsScreen />);
		expect(screen.queryByRole("button", { name: /edit, then allow/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /always allow/i })).toBeNull();
	});

	it("groups by Dot with Deny all once there are many", () => {
		useApprovals.setState({ pending: [req("1"), req("2"), req("3", { dotId: "dot_b" as ApprovalRequest["dotId"] })] });
		render(<ApprovalsScreen />);
		const buttons = screen.getAllByRole("button", { name: /^deny all$/i });
		expect(buttons).toHaveLength(2);
		fireEvent.click(buttons[0]!);
		expect(denyAll).toHaveBeenCalledWith("dot_a", undefined);
	});

	it("groupByDot keeps arrival order", () => {
		const g = groupByDot([req("1"), req("2", { dotId: "dot_b" as ApprovalRequest["dotId"] }), req("3")]);
		expect(g.map((x) => [x.dotId, x.items.length])).toEqual([
			["dot_a", 2],
			["dot_b", 1],
		]);
	});

	it("shows the empty state", () => {
		render(<ApprovalsScreen />);
		expect(screen.getByText("Nothing is waiting for you.")).toBeTruthy();
	});
});
