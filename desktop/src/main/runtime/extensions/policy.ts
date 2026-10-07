// tool_call gate: path guard + allow/ask/deny + approvals (spec 06 §3.1).
import { approvalTitle, changedKeys, formatApprovalDetail } from "../../../shared/approvals/describe";
import type { Connection, Dot, ToolDecision } from "../../../shared/types";
import { checkPath, fileToolPath } from "../../connections/mac/path-guard";
import type { ApprovalBroker } from "../../security/approval-broker";
import type { PolicyEngine, ToolAnnotations } from "../../security/policy-engine";
import type { InlineExtension } from "../pi-adapter";
import { humanToolLabel } from "../views";

export interface PolicyExtDeps {
	policy: PolicyEngine;
	approvals: ApprovalBroker;
	getDot: () => Promise<Dot>;
	/** Which installed connection a tool name belongs to (undefined for OpenDot tools). */
	connectionFor: (dot: Dot, toolName: string) => Connection | undefined;
	nativeDefault: (toolName: string) => ToolDecision | undefined;
	allowedRoots: (dot: Dot) => string[];
	audit: (
		kind: "tool-call" | "tool-blocked" | "approval",
		dot: Dot,
		summary: string,
		data: Record<string, string | number | boolean | null>,
	) => void;
	approvalTtlMs: () => number;
	/** Approvals decided by an Always allow rule are recorded in the inbox history (no prompt was shown). */
	recordRuleAllow?: (dot: Dot, toolName: string, args: unknown) => void;
	/** Puts real values back into text the model wrote (PII tokens), for the "why" shown to the user. */
	restore?: (text: string) => string;
}

/** Longest "why" kept: the Dot's own words just before the call. */
const WHY_MAX = 400;

/** What the user typed as a reason, folded into the message the model sees. */
export function denyReasonText(reason: string | undefined): string {
	return reason
		? `The user declined this action. Their reason: "${reason}". Take it into account and adapt, or ask what they would like instead.`
		: "The user declined this action.";
}

/**
 * Edited arguments, restricted to the fields the inbox lets people edit (the tool's own editable string fields).
 * Returns undefined when nothing valid or nothing changed.
 */
export function sanitizeEditedArgs(
	toolName: string,
	original: unknown,
	edited: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!edited || typeof edited !== "object") return undefined;
	const detail = formatApprovalDetail(toolName, original);
	const allowed = new Set(detail.fields.map((f) => f.key));
	const picked: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(edited)) {
		if (!allowed.has(k)) continue;
		const isList = Array.isArray(v) && v.every((x) => typeof x === "string");
		if (typeof v === "string" || isList) picked[k] = v;
	}
	return changedKeys(original, { ...(original as object), ...picked }).length ? picked : undefined;
}

function assistantText(message: unknown): string {
	const m = message as { role?: string; content?: unknown };
	if (m?.role !== "assistant" || !Array.isArray(m.content)) return "";
	return (m.content as Array<{ type?: string; text?: string }>)
		.filter((b) => b.type === "text" && typeof b.text === "string")
		.map((b) => b.text)
		.join("")
		.trim();
}

const FILE_TOOLS = new Set(["read", "write", "edit", "ls", "grep", "find"]);

function summarize(args: unknown): string {
	if (!args || typeof args !== "object") return "";
	const a = args as Record<string, unknown>;
	const pick = ["to", "subject", "command", "path", "url", "title", "name", "query", "chatId", "text", "message"];
	const parts: string[] = [];
	for (const k of pick) if (typeof a[k] === "string") parts.push(`${k}: ${String(a[k]).slice(0, 120)}`);
	return parts.join(" · ") || JSON.stringify(a).slice(0, 200);
}

export function policyExtension(deps: PolicyExtDeps): InlineExtension {
	return {
		name: "opendot-policy",
		hidden: true,
		factory: (api) => {
			let lastSaid = "";
			/** toolCallId -> argument keys the user edited, so the model is told its call ran with changes. */
			const edited = new Map<string, string[]>();
			api.on("message_end", (event) => {
				const said = assistantText(event.message);
				if (said) lastSaid = said;
			});
			api.on("tool_result", (event) => {
				const keys = edited.get(event.toolCallId);
				if (!keys) return;
				edited.delete(event.toolCallId);
				return {
					content: [
						...event.content,
						{
							type: "text" as const,
							text: `Note: the user edited these fields before allowing the action: ${keys.join(", ")}. It ran with their version, not yours.`,
						},
					],
				};
			});
			api.on("tool_call", async (event, ctx) => {
				const dot = await deps.getDot();
				const name = event.toolName;
				if (FILE_TOOLS.has(name)) {
					const target = fileToolPath(name, event.input);
					if (target) {
						const res = await checkPath(target, deps.allowedRoots(dot));
						if (!res.ok) {
							deps.audit("tool-blocked", dot, `${name} outside allowed folders`, { tool: name });
							return { block: true, reason: res.reason };
						}
					}
				}
				const info = api.getAllTools().find((t) => t.name === name) as { annotations?: ToolAnnotations } | undefined;
				const d = await deps.policy.decide({
					dot,
					toolName: name,
					annotations: info?.annotations,
					connection: deps.connectionFor(dot, name),
					nativeDefault: deps.nativeDefault(name),
				});
				if (d.decision === "allow") {
					if (d.ruleSource === "always") deps.recordRuleAllow?.(dot, name, event.input);
					deps.audit("tool-call", dot, `${humanToolLabel(name)} (allowed: ${d.reason})`, {
						tool: name,
						decision: "allow",
					});
					return;
				}
				if (d.decision === "deny") {
					deps.audit("tool-blocked", dot, `${humanToolLabel(name)} blocked: ${d.reason}`, { tool: name });
					return { block: true, reason: `Blocked by OpenDot: ${d.reason}` };
				}
				const said = lastSaid ? (deps.restore ? deps.restore(lastSaid) : lastSaid) : "";
				const res = await deps.approvals.requestDetailed(
					{
						kind: "tool",
						dotId: dot.id,
						title: approvalTitle(dot.name, name),
						detail: summarize(event.input),
						toolName: name,
						args: event.input,
						...(said ? { why: said.length > WHY_MAX ? `${said.slice(0, WHY_MAX - 1)}…` : said } : {}),
						alwaysAllowable: d.ruleSource !== "dot-rule",
					},
					{ signal: ctx.signal, ttlMs: deps.approvalTtlMs() },
				);
				if (res.outcome === "allow-always") await deps.policy.rememberAlways(dot.id, name);
				if (res.outcome === "deny") return { block: true, reason: denyReasonText(res.reason) };
				if (res.outcome === "expired") {
					return {
						block: true,
						reason: "The approval request expired before the user answered. Ask again if it still matters.",
					};
				}
				// Allowed. pi lets a tool_call handler mutate `event.input` in place; the tool then runs with these arguments.
				const patch = sanitizeEditedArgs(name, event.input, res.editedArgs);
				if (patch) {
					const keys = changedKeys(event.input, { ...(event.input as object), ...patch });
					Object.assign(event.input as Record<string, unknown>, patch);
					edited.set(event.toolCallId, keys);
				}
				return;
			});
		},
	};
}
