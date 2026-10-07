import { describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "../../shared/types";
import { type ApprovalNotice, ApprovalNotifier } from "./notifier";

const req = (id: string, title = `Inbox wants to send an email (${id})`): ApprovalRequest => ({
	id: `apr_${id}`,
	kind: "tool",
	dotId: "dot_a",
	title,
	detail: "",
	createdAt: "",
	expiresAt: "",
});

function setup(pending: () => number) {
	vi.useFakeTimers();
	const sent: ApprovalNotice[] = [];
	const n = new ApprovalNotifier({ notify: (x) => sent.push(x), pendingCount: pending, windowMs: 10_000 });
	return { n, sent };
}

describe("ApprovalNotifier", () => {
	it("notifies a lone approval at once with a link to it", () => {
		const { n, sent } = setup(() => 1);
		n.requested(req("1", "Inbox wants to send an email"));
		expect(sent).toEqual([
			expect.objectContaining({ title: "Inbox wants to send an email", hash: "#/approvals/apr_1" }),
		]);
		n.dispose();
		vi.useRealTimers();
	});

	it("folds the rest of a burst into one 'N approvals waiting'", () => {
		const { n, sent } = setup(() => 3);
		n.requested(req("1"));
		vi.advanceTimersByTime(2000);
		n.requested(req("2"));
		n.requested(req("3"));
		expect(sent).toHaveLength(1);
		vi.advanceTimersByTime(8000);
		expect(sent).toHaveLength(2);
		expect(sent[1]).toMatchObject({ title: "3 approvals waiting", hash: "#/approvals" });
		// Nothing more once the burst is over.
		vi.advanceTimersByTime(60_000);
		expect(sent).toHaveLength(2);
		n.dispose();
		vi.useRealTimers();
	});

	it("stays quiet when the held ones were answered meanwhile, and notifies again after the window", () => {
		let pending = 2;
		const { n, sent } = setup(() => pending);
		n.requested(req("1"));
		n.requested(req("2"));
		pending = 0;
		vi.advanceTimersByTime(10_000);
		expect(sent).toHaveLength(1);
		vi.advanceTimersByTime(10_000);
		n.requested(req("3"));
		expect(sent).toHaveLength(2);
		expect(sent[1]?.hash).toBe("#/approvals/apr_3");
		n.dispose();
		vi.useRealTimers();
	});
});
