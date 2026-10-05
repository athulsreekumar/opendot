// Tool permissions: allow / ask / deny per Dot (spec 06 §3).
import type { Connection, Dot, DotId, ToolDecision } from "../../shared/types";
import type { Store } from "../store/store";

export interface ToolAnnotations {
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	openWorldHint?: boolean;
	idempotentHint?: boolean;
}

export interface ToolContext {
	dot: Dot;
	toolName: string;
	annotations?: ToolAnnotations;
	/** The connection this tool belongs to (undefined for OpenDot tools and pi built-ins without a mac grant). */
	connection?: Connection;
	/** Default decisions for native tools (e.g. MAC_DEFAULT_DECISIONS). */
	nativeDefault?: ToolDecision;
}

export type RuleSource =
	| "not-granted"
	| "dot-rule"
	| "always"
	| "connection-default"
	| "native-default"
	| "builtin"
	| "annotation";

/** OpenDot's own tools — always available, decided here. */
const OPENDOT_TOOLS: Record<string, ToolDecision> = {
	list_dots: "allow",
	message_dot: "allow",
	ask_dots: "allow",
	get_dot_updates: "allow",
	search_dot_history: "allow",
	remember: "allow",
	forget: "allow",
	recall: "allow",
	codemode: "allow",
	tool_search: "allow",
	list_mcp_resources: "allow",
	list_mcp_resource_templates: "allow",
	read_mcp_resource: "allow",
};

const BUILTIN_DEFAULTS: Record<string, ToolDecision> = {
	read: "allow",
	ls: "allow",
	grep: "allow",
	find: "allow",
	write: "ask",
	edit: "ask",
	bash: "ask",
};

function patternMatch(pattern: string, name: string): boolean {
	if (!pattern.includes("*")) return pattern === name;
	const re = new RegExp(
		`^${pattern
			.split("*")
			.map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
			.join(".*")}$`,
	);
	return re.test(name);
}

export function annotationDefault(a?: ToolAnnotations): ToolDecision {
	if (a?.destructiveHint === true) return "ask";
	if (a?.readOnlyHint === true) return "allow";
	return (a?.destructiveHint ?? true) || (a?.openWorldHint ?? true) ? "ask" : "allow";
}

export class PolicyEngine {
	constructor(private readonly store: Store) {}

	async decide(ctx: ToolContext): Promise<{ decision: ToolDecision; reason: string; ruleSource: RuleSource }> {
		const { dot, toolName } = ctx;
		if (toolName in OPENDOT_TOOLS)
			return { decision: OPENDOT_TOOLS[toolName]!, reason: "OpenDot tool", ruleSource: "builtin" };
		const grant = ctx.connection ? dot.grants.find((g) => g.connectionId === ctx.connection!.id) : undefined;
		if (!ctx.connection || !grant) {
			return { decision: "deny", reason: `${toolName} is not granted to ${dot.name}`, ruleSource: "not-granted" };
		}
		const exact = grant.toolRules[toolName];
		if (exact) return { decision: exact, reason: "Rule for this tool", ruleSource: "dot-rule" };
		for (const [pattern, d] of Object.entries(grant.toolRules)) {
			if (patternMatch(pattern, toolName)) return { decision: d, reason: `Rule ${pattern}`, ruleSource: "dot-rule" };
		}
		const policy = await this.store.policy.read();
		if (policy.rules.some((r) => r.dotId === dot.id && r.toolName === toolName)) {
			return { decision: "allow", reason: "You chose “Always allow”", ruleSource: "always" };
		}
		if (grant.defaultDecision)
			return { decision: grant.defaultDecision, reason: "Connection default", ruleSource: "connection-default" };
		if (toolName in BUILTIN_DEFAULTS)
			return { decision: BUILTIN_DEFAULTS[toolName]!, reason: "Built-in default", ruleSource: "builtin" };
		if (ctx.nativeDefault)
			return { decision: ctx.nativeDefault, reason: "Default for this tool", ruleSource: "native-default" };
		return {
			decision: annotationDefault(ctx.annotations),
			reason: "Based on what the tool does",
			ruleSource: "annotation",
		};
	}

	async rememberAlways(dotId: DotId, toolName: string): Promise<void> {
		await this.store.policy.update((p) => ({
			rules: [
				...p.rules.filter((r) => !(r.dotId === dotId && r.toolName === toolName)),
				{ dotId, toolName, createdAt: new Date().toISOString() },
			],
		}));
	}

	async forget(dotId: DotId, toolName?: string): Promise<void> {
		await this.store.policy.update((p) => ({
			rules: p.rules.filter((r) => !(r.dotId === dotId && (!toolName || r.toolName === toolName))),
		}));
	}

	async alwaysAllowed(dotId: DotId): Promise<string[]> {
		return (await this.store.policy.read()).rules.filter((r) => r.dotId === dotId).map((r) => r.toolName);
	}
}
