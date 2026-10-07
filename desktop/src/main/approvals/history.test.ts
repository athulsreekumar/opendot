import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ApprovalRequest, AuditEntry, PiiSettings } from "../../shared/types";
import { JsonlFile } from "../store/store";
import { ApprovalHistory, maskSummary, toHistoryItem } from "./history";

const pii: PiiSettings = { enabledTypes: [], customTerms: [], detectNames: false };

function makeHistory() {
	const file = join(mkdtempSync(join(tmpdir(), "opendot-hist-")), "audit.jsonl");
	const log = new JsonlFile<AuditEntry>(file);
	const history = new ApprovalHistory({
		append: (e) => log.append(e),
		read: async (q) =>
			(await log.readAll()).filter((e) => e.kind === "approval" && (!q.dotId || e.dotId === q.dotId)).reverse(),
		piiSettings: async () => pii,
	});
	return { history, file, log };
}

const req = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
	id: "apr_1",
	kind: "tool",
	dotId: "dot_a",
	title: "Inbox wants to send an email",
	detail: "",
	toolName: "mcp__gmail__send_message",
	args: { to: "jane@example.com", subject: "Lunch with jane@example.com", body: "Top secret body" },
	createdAt: "2026-01-01T00:00:00.000Z",
	expiresAt: "2026-01-01T00:05:00.000Z",
	...over,
});

describe("ApprovalHistory", () => {
	it("persists decisions in the audit log with masked, content-free summaries", async () => {
		const { history, file } = makeHistory();
		await history.record(req(), { outcome: "allow-once", by: "you" });
		await history.record(req({ id: "apr_2" }), { outcome: "deny", by: "you", reason: "not now, it is private" });
		await history.record(req({ id: "apr_3" }), { outcome: "allow-once", by: "you", editedArgs: { body: "Edited" } });
		await history.record(req({ id: "apr_4" }), { outcome: "expired", by: "timeout" });
		await history.recordRule("dot_a", "mcp__gmail__send_message", req().args);

		const raw = readFileSync(file, "utf8");
		expect(raw).not.toContain("jane@example.com");
		expect(raw).not.toContain("Top secret body");
		expect(raw).not.toContain("not now, it is private");
		expect(raw).toContain("[email]");

		const items = await history.list();
		expect(items.map((i) => [i.outcome, i.by])).toEqual([
			["allowed", "rule"],
			["expired", "timeout"],
			["edited", "you"],
			["denied", "you"],
			["allowed", "you"],
		]);
		expect(items[3]?.hasReason).toBe(true);
		expect(items[0]?.summary).toBe("Send an email: Lunch with [email]");
	});

	it("filters by Dot and outcome and survives a restart", async () => {
		const { history, log } = makeHistory();
		await history.record(req(), { outcome: "allow-always", by: "you" });
		await history.record(req({ dotId: "dot_b", id: "apr_9" }), { outcome: "deny", by: "stopped" });
		const reopened = new ApprovalHistory({
			append: (e) => log.append(e),
			read: async (q) => (await log.readAll()).filter((e) => !q.dotId || e.dotId === q.dotId).reverse(),
			piiSettings: async () => pii,
		});
		expect((await reopened.list({ dotId: "dot_b" })).map((i) => i.outcome)).toEqual(["denied"]);
		const allowed = await reopened.list({ outcome: "allowed" });
		expect(allowed).toHaveLength(1);
		expect(allowed[0]?.always).toBe(true);
	});
});

describe("toHistoryItem", () => {
	it("reads older approval entries", () => {
		const item = toHistoryItem({
			id: "aud_1",
			at: "2026-01-01T00:00:00.000Z",
			kind: "approval",
			dotId: "dot_a",
			summary: "Shell: allow-always",
			data: { tool: "bash", outcome: "allow-always" },
		});
		expect(item).toMatchObject({ outcome: "allowed", always: true, by: "you", toolName: "bash" });
	});
	it("ignores other audit kinds", () => {
		expect(toHistoryItem({ id: "x", at: "", kind: "tool-call", summary: "", data: {} })).toBeUndefined();
	});
});

describe("maskSummary", () => {
	it("masks emails, phones and secrets", () => {
		expect(maskSummary("Mail bob@example.com or +1 415-555-2671", pii)).toBe("Mail [email] or [phone]");
	});
});
