// The only file that imports pi directly (spec 03 §1). Fix pi API drift here.

export type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";
export {
	fauxAssistantMessage,
	fauxProvider,
	fauxText,
	fauxThinking,
	fauxToolCall,
	StringEnum,
	Type,
} from "@earendil-works/pi-ai";
export type {
	AgentSession,
	AgentSessionEvent,
	ExtensionAPI,
	ExtensionContext,
	ExtensionFactory,
	InlineExtension,
	LoadedMcpConfig,
	McpServerConfig,
	McpServerEntry,
	ToolDefinition,
} from "@earendil-works/pi-coding-agent";
export {
	createAgentSession,
	createCodemodeExtension,
	createMcpExtension,
	createToolSearchExtension,
	DefaultResourceLoader,
	defineTool,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
export { McpClient, StdioTransport, StreamableHttpTransport } from "@earendil-works/pi-mcp";

export const PI_VERSION = "1.0.2";
