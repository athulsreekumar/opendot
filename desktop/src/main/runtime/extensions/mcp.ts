// MCP servers granted to a Dot, via pi's own MCP extension (spec 05 §3).
import type { Connection, ConnectionStatus } from "../../../shared/types";
import {
	createCodemodeExtension,
	createMcpExtension,
	createToolSearchExtension,
	type InlineExtension,
	type LoadedMcpConfig,
	type McpServerConfig,
} from "../pi-adapter";

export interface McpExtDeps {
	servers: Array<{ name: string; config: McpServerConfig; connection: Connection }>;
	logPath: string;
	openUrl: (url: string) => void;
	reportStatus: (s: ConnectionStatus) => void;
}

const toolPrefix = (name: string) => `mcp__${name.replace(/[^A-Za-z0-9_]/g, "_")}__`;

export function mcpExtensions(deps: McpExtDeps): InlineExtension[] {
	if (!deps.servers.length) return [];
	const loadConfig = (): LoadedMcpConfig =>
		({
			servers: deps.servers.map((s) => ({ name: s.name, config: s.config, source: "opendot", scope: "global" })),
			autoEnableCodemode: true,
			errors: [],
		}) as unknown as LoadedMcpConfig;
	return [
		{ name: "opendot-codemode", hidden: true, factory: createCodemodeExtension({ mode: "on" }) },
		{ name: "opendot-tool-search", hidden: true, factory: createToolSearchExtension() },
		{
			name: "opendot-mcp",
			hidden: true,
			factory: createMcpExtension({
				loadConfig,
				logPath: deps.logPath,
				openUrl: deps.openUrl,
				updateConfig: () => undefined,
			}),
		},
		{
			// Status reporting. Must NOT subscribe to mcp_servers_change (spec 05 §3.3).
			name: "opendot-mcp-status",
			hidden: true,
			factory: (api) => {
				const report = () => {
					const all = api.getAllTools() as Array<{
						name: string;
						description?: string;
						annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
					}>;
					for (const s of deps.servers) {
						const pre = toolPrefix(s.name);
						const tools = all.filter((t) => t.name.startsWith(pre));
						if (!tools.length) continue;
						deps.reportStatus({
							connectionId: s.connection.id,
							state: "connected",
							toolCount: tools.length,
							tools: tools.map((t) => ({
								name: t.name.slice(pre.length),
								description: (t.description ?? "").split("\n")[0]!.slice(0, 200),
								exposure: s.connection.toolExposure[t.name.slice(pre.length)] ?? s.connection.exposure,
								readOnly: t.annotations?.readOnlyHint === true,
								destructive: t.annotations?.destructiveHint === true,
							})),
							checkedAt: new Date().toISOString(),
						});
					}
				};
				api.on("session_start", () => {
					let n = 0;
					const timer = setInterval(() => {
						report();
						if (++n >= 15) clearInterval(timer);
					}, 2000);
					timer.unref?.();
				});
				api.on("turn_end", () => report());
			},
		},
	];
}
