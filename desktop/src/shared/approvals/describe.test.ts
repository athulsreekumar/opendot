import { describe, expect, it } from "vitest";
import {
	applyEdits,
	approvalTitle,
	changedKeys,
	formatApprovalDetail,
	humanizeTool,
	summarizeApproval,
} from "./describe";

describe("humanizeTool", () => {
	it.each([
		["bash", "Run a command"],
		["write", "Write a file"],
		["edit", "Edit a file"],
		["mcp__gmail__send_message", "Send an email"],
		["mcp__gmail__send_email", "Send an email"],
		["send_email", "Send an email"],
		["gmail_reply", "Reply to an email"],
		["mcp__outlook__forward", "Forward an email"],
		["delete_file", "Delete a file"],
		["create_event", "Create an event"],
		["mcp__echo__delete_everything", "Delete everything"],
		["message_dot", "Message another Dot"],
	])("%s -> %s", (name, label) => {
		expect(humanizeTool(name)).toBe(label);
	});

	it("falls back to readable words", () => {
		expect(humanizeTool("frobnicate_widget")).toBe("Frobnicate widget");
	});

	it("builds the sentence used in titles and notifications", () => {
		expect(approvalTitle("Inbox", "mcp__gmail__send_message")).toBe("Inbox wants to send an email");
		expect(approvalTitle("Ops", "bash")).toBe("Ops wants to run a command");
	});
});

describe("formatApprovalDetail", () => {
	it("formats an email with To / Subject / Body and editable fields", () => {
		const d = formatApprovalDetail("mcp__gmail__send_message", {
			to: ["a@x.com", "b@x.com"],
			subject: "Hello",
			body: "Hi there",
		});
		expect(d.kind).toBe("email");
		if (d.kind !== "email") return;
		expect(d.to).toBe("a@x.com, b@x.com");
		expect(d.subject).toBe("Hello");
		expect(d.fields.map((f) => f.key)).toEqual(["to", "subject", "body"]);
		expect(d.fields[0]?.list).toBe(true);
	});

	it("formats shell commands as editable code", () => {
		const d = formatApprovalDetail("bash", { command: "ls -la" });
		expect(d).toMatchObject({ kind: "shell", command: "ls -la" });
		expect(d.fields[0]?.key).toBe("command");
	});

	it("shows a path and a shortened preview for file writes", () => {
		const content = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
		const d = formatApprovalDetail("write", { path: "notes/a.txt", content });
		expect(d.kind).toBe("file");
		if (d.kind !== "file") return;
		expect(d.path).toBe("notes/a.txt");
		expect(d.previewTruncated).toBe(true);
		expect(d.preview.split("\n")).toHaveLength(40);
		expect(d.fields[0]?.key).toBe("content");
		// The edit field holds the whole content, not the shortened preview.
		expect(d.fields[0]?.value).toBe(content);
	});

	it("shows file edits as a before/after preview without editable fields", () => {
		const d = formatApprovalDetail("edit", { path: "a.txt", edits: [{ oldText: "foo", newText: "bar" }] });
		expect(d).toMatchObject({ kind: "file", operation: "edit", preview: "- foo\n+ bar", fields: [] });
	});

	it("shows chat messages", () => {
		const d = formatApprovalDetail("slack_post_message", { chatId: "C1", text: "ship it" });
		expect(d).toMatchObject({ kind: "message", to: "C1", text: "ship it" });
		expect(d.fields[0]?.key).toBe("text");
	});

	it("falls back to JSON for anything else", () => {
		const d = formatApprovalDetail("mcp__echo__delete_everything", { scope: "all" });
		expect(d.kind).toBe("json");
		expect(d.fields).toEqual([]);
		expect(d).toMatchObject({ json: JSON.stringify({ scope: "all" }, null, 2) });
	});

	it("never throws on odd arguments", () => {
		for (const args of [undefined, null, "x", 5, [], { to: 5 }]) {
			expect(() => formatApprovalDetail("send_email", args)).not.toThrow();
		}
	});
});

describe("edits", () => {
	it("applyEdits keeps untouched arguments and turns list fields back into lists", () => {
		const args = { to: ["a@x.com"], subject: "Hi", body: "Old", cc: "z@x.com" };
		const d = formatApprovalDetail("send_email", args);
		const out = applyEdits(args, d.fields, { to: "a@x.com, c@x.com", body: "New" });
		expect(out).toEqual({ to: ["a@x.com", "c@x.com"], subject: "Hi", body: "New", cc: "z@x.com" });
		expect(changedKeys(args, out)).toEqual(["to", "body"]);
	});
});

describe("summarizeApproval", () => {
	it("is one short line without message bodies", () => {
		const s = summarizeApproval("mcp__gmail__send_message", {
			to: "a@x.com",
			subject: "Quarterly numbers",
			body: "SECRET BODY",
		});
		expect(s).toBe("Send an email: Quarterly numbers");
		expect(s).not.toContain("SECRET");
		expect(summarizeApproval("bash", { command: "rm -rf build" })).toBe("Run a command: rm -rf build");
		expect(summarizeApproval("write", { path: "/home/me/docs/a.txt", content: "x" })).toBe("Write a file: a.txt");
	});
});
