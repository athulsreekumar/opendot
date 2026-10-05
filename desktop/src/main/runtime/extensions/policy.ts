// tool_call gate: path guard + allow/ask/deny + approvals (spec 06 §3.1).
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
				const outcome = await deps.approvals.request(
					{
						kind: "tool",
						dotId: dot.id,
						title: `${dot.name} wants to use ${humanToolLabel(name)}`,
						detail: summarize(event.input),
						toolName: name,
						args: event.input,
					},
					{ signal: ctx.signal, ttlMs: deps.approvalTtlMs() },
				);
				deps.audit("approval", dot, `${humanToolLabel(name)}: ${outcome}`, { tool: name, outcome });
				if (outcome === "allow-always") await deps.policy.rememberAlways(dot.id, name);
				if (outcome === "deny" || outcome === "expired") {
					return { block: true, reason: "The user declined this action." };
				}
				return;
			});
		},
	};
}
