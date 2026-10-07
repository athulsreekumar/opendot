import { describe, expect, it, vi } from "vitest";
import { defaultAlwaysOn, defaultPersona, emptyProfile } from "../../../shared/defaults";
import type { Dot } from "../../../shared/types";
import { ApprovalBroker } from "../../security/approval-broker";
import { denyReasonText, type PolicyExtDeps, policyExtension, sanitizeEditedArgs } from "./policy";

const dot = {
	id: "dot_a",
	kind: "standard",
	name: "Inbox",
	persona: defaultPersona("Inbox"),
	grants: [],
	profile: emptyProfile(),
	alwaysOn: defaultAlwaysOn(),
	workspaceDir: "/tmp",
} as unknown as Dot;

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

function setup(decision: "ask" | "allow" = "ask", ruleSource = "annotation") {
	const handlers = new Map<string, Handler>();
	const approvals = new ApprovalBroker({ requested: () => undefined, resolved: () => undefined });
	const rememberAlways = vi.fn(async () => undefined);
	const recordRuleAllow = vi.fn();
	const deps: PolicyExtDeps = {
		policy: { decide: async () => ({ decision, reason: "r", ruleSource }), rememberAlways } as never,
		approvals,
		getDot: async () => dot,
		connectionFor: () => undefined,
		nativeDefault: () => undefined,
		allowedRoots: () => ["/tmp"],
		audit: () => undefined,
		approvalTtlMs: () => 60_000,
		recordRuleAllow,
	};
	const ext = policyExtension(deps);
	(ext as { factory: (api: never) => void }).factory({
		on: (name: string, h: Handler) => handlers.set(name, h),
		getAllTools: () => [],
	} as never);
	const call = (toolName: string, input: Record<string, unknown>, toolCallId = "tc1") =>
		handlers.get("tool_call")!({ toolName, input, toolCallId }, { signal: undefined }) as Promise<
			{ block?: boolean; reason?: string } | undefined
		>;
	const answer = async (
		res: Parameters<ApprovalBroker["respond"]>[0] extends infer R ? Omit<R & object, "id"> : never,
	) => {
		await vi.waitFor(() => expect(approvals.pending()).toHaveLength(1));
		approvals.respond({ id: approvals.pending()[0]!.id, ...res } as never);
	};
	return { handlers, approvals, call, answer, rememberAlways, recordRuleAllow };
}

describe("policy extension approvals", () => {
	it("asks with a human title, the Dot's own words as the why, and the tool call's arguments", async () => {
		const t = setup();
		await t.handlers.get("message_end")!(
			{ message: { role: "assistant", content: [{ type: "text", text: "Sending the invoice you asked for." }] } },
			{},
		);
		const p = t.call("mcp__gmail__send_message", { to: "a@x.com", subject: "Invoice", body: "Hi" });
		await vi.waitFor(() => expect(t.approvals.pending()).toHaveLength(1));
		const req = t.approvals.pending()[0]!;
		expect(req).toMatchObject({
			title: "Inbox wants to send an email",
			why: "Sending the invoice you asked for.",
			alwaysAllowable: true,
		});
		t.approvals.respond({ id: req.id, decision: "allow-once" });
		expect(await p).toBeUndefined();
	});

	it("edit then allow: the tool call runs with the edited arguments", async () => {
		const t = setup();
		const input = { path: "note.txt", content: "original" };
		const p = t.call("write", input);
		await t.answer({ decision: "allow-once", editedArgs: { content: "edited by me" } });
		expect(await p).toBeUndefined();
		expect(input).toEqual({ path: "note.txt", content: "edited by me" });
	});

	it("tells the model its call ran with edits", async () => {
		const t = setup();
		const input = { to: "a@x.com", subject: "S", body: "Old" };
		const p = t.call("send_email", input, "tc9");
		await t.answer({ decision: "allow-once", editedArgs: { body: "New" } });
		await p;
		const out = (await t.handlers.get("tool_result")!(
			{ toolCallId: "tc9", content: [{ type: "text", text: "sent" }] },
			{},
		)) as {
			content: Array<{ text: string }>;
		};
		expect(out.content).toHaveLength(2);
		expect(out.content[1]?.text).toContain("body");
		// Only once.
		expect(await t.handlers.get("tool_result")!({ toolCallId: "tc9", content: [] }, {})).toBeUndefined();
	});

	it("ignores edits to fields that are not editable", async () => {
		const t = setup();
		const input = { path: "note.txt", content: "original" };
		const p = t.call("write", input);
		await t.answer({ decision: "allow-once", editedArgs: { path: "/etc/passwd", content: "ok" } });
		await p;
		expect(input).toEqual({ path: "note.txt", content: "ok" });
	});

	it("deny passes the reason back to the Dot", async () => {
		const t = setup();
		const p = t.call("bash", { command: "rm -rf /" });
		await t.answer({ decision: "deny", reason: "never run that" });
		const r = await p;
		expect(r?.block).toBe(true);
		expect(r?.reason).toContain("never run that");
		expect(r?.reason).toBe(denyReasonText("never run that"));
	});

	it("deny without a reason keeps the plain message", async () => {
		const t = setup();
		const p = t.call("bash", { command: "ls" });
		await t.answer({ decision: "deny" });
		expect((await p)?.reason).toBe("The user declined this action.");
	});

	it("always allow remembers the rule, but not when an explicit rule on the tool would win", async () => {
		const t = setup();
		const p = t.call("bash", { command: "ls" });
		await t.answer({ decision: "allow-always" });
		await p;
		expect(t.rememberAlways).toHaveBeenCalledWith("dot_a", "bash");

		const t2 = setup("ask", "dot-rule");
		const p2 = t2.call("bash", { command: "ls" });
		await vi.waitFor(() => expect(t2.approvals.pending()).toHaveLength(1));
		expect(t2.approvals.pending()[0]?.alwaysAllowable).toBe(false);
		t2.approvals.respond({ id: t2.approvals.pending()[0]!.id, decision: "deny" });
		await p2;
	});

	it("records calls let through by an Always allow rule", async () => {
		const t = setup("allow", "always");
		await t.call("bash", { command: "ls" });
		expect(t.recordRuleAllow).toHaveBeenCalledOnce();
		const t2 = setup("allow", "builtin");
		await t2.call("read", { path: "a" });
		expect(t2.recordRuleAllow).not.toHaveBeenCalled();
	});
});

describe("sanitizeEditedArgs", () => {
	it("keeps only editable string fields that actually changed", () => {
		const args = { to: ["a@x.com"], subject: "S", body: "B" };
		expect(sanitizeEditedArgs("send_email", args, { subject: "S", body: "B2", evil: "x", to: 5 })).toEqual({
			subject: "S",
			body: "B2",
		});
		expect(sanitizeEditedArgs("send_email", args, { subject: "S" })).toBeUndefined();
		expect(sanitizeEditedArgs("send_email", args, undefined)).toBeUndefined();
		expect(sanitizeEditedArgs("mcp__echo__delete_everything", {}, { anything: "x" })).toBeUndefined();
	});
});
