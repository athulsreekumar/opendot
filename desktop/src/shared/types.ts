// Single source of truth for OpenDot domain types. Pure TS: no node/electron/dom imports.
// Spec: docs/spec/02-data-and-ipc.md

// ───────────────────────── Primitives ─────────────────────────
export type DotId = `dot_${string}`;
export type LinkId = `lnk_${string}`;
export type ConnectionId = `con_${string}`;
export type ApprovalId = `apr_${string}`;
export type WatcherId = `wat_${string}`;
export type MessageId = string;
export type ISODate = string;

export type ThemeMode = "light" | "dark" | "system";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

// ───────────────────────── Models / providers ─────────────────────────
export type ProviderKind = "cloud" | "self-hosted" | "custom-url";
export type WireApi = "openai-completions" | "openai-responses" | "anthropic-messages";
export type SelfHostedPreset = "ollama" | "lmstudio" | "llamacpp" | "vllm";

export interface ProviderModel {
	id: string;
	label?: string;
	contextWindow?: number;
	vision?: boolean;
	reasoning?: boolean;
}

export interface ProviderSettings {
	/** Stable id used in pi, e.g. "anthropic", "ollama-local", "custom-acme". Lowercase, [a-z0-9-]. */
	id: string;
	kind: ProviderKind;
	label: string;
	/** For cloud: pi built-in provider id. */
	builtinProviderId?: string;
	preset?: SelfHostedPreset;
	baseUrl?: string;
	api?: WireApi;
	/** Extra non-secret headers. */
	headers?: Record<string, string>;
	models?: ProviderModel[];
	isLocal: boolean;
	enabled: boolean;
	hasSecret: boolean;
	secretHint?: string;
	lastTest?: { ok: boolean; message: string; at: ISODate };
	createdAt: ISODate;
}

export interface ModelRef {
	providerId: string;
	modelId: string;
}

export interface ModelOption extends ModelRef {
	label: string;
	providerLabel: string;
	isLocal: boolean;
	contextWindow?: number;
	vision: boolean;
	reasoning: boolean;
}

// ───────────────────────── Persona / Dot ─────────────────────────
export type Tone = "warm" | "neutral" | "playful" | "direct" | "formal";

export interface Persona {
	role: string;
	tone: Tone;
	verbosity: number;
	formality: number;
	emojiUsage: number;
	quirks: string[];
	dos: string[];
	donts: string[];
	customInstructions: string;
	greeting: string;
}

export type PiiMode = "auto" | "always" | "off";

export type DotColor =
	| "teal"
	| "green"
	| "lime"
	| "amber"
	| "orange"
	| "rose"
	| "pink"
	| "violet"
	| "indigo"
	| "blue"
	| "sky"
	| "slate";

export const DOT_COLORS: readonly DotColor[] = [
	"teal",
	"green",
	"lime",
	"amber",
	"orange",
	"rose",
	"pink",
	"violet",
	"indigo",
	"blue",
	"sky",
	"slate",
];

export interface DotAppearance {
	emoji: string;
	color: DotColor;
}

export type DotKind = "standard" | "super";

export interface AlwaysOnSettings {
	enabled: boolean;
	standingInstructions: string;
	notify: "urgent" | "updates" | "none";
	quietHours?: LinkSchedule;
	batchWindowSec: number;
	budget: { maxTurnsPerHour: number; maxCostUsdPerDay: number };
}

export interface DotProfile {
	capabilities: string[];
	dataSources: string[];
	knowledgeSummary: string;
	updatedAt: ISODate;
}

export interface Dot {
	id: DotId;
	kind: DotKind;
	name: string;
	tagline: string;
	appearance: DotAppearance;
	persona: Persona;
	templateId?: string;
	creationPrompt?: string;
	suggestedConnections: string[];
	model?: ModelRef;
	thinkingLevel: ThinkingLevel;
	grants: ConnectionGrant[];
	roles: string[];
	piiMode: PiiMode;
	alwaysOn: AlwaysOnSettings;
	profile: DotProfile;
	hiddenFromSuper: boolean;
	workspaceDir: string;
	pinned: boolean;
	muted: boolean;
	archived: boolean;
	createdAt: ISODate;
	updatedAt: ISODate;
	lastActivityAt: ISODate;
	lastMessagePreview: string;
	unreadCount: number;
}

// ───────────────────────── Connections ─────────────────────────
export type ConnectionType = "mcp-stdio" | "mcp-http" | "google" | "microsoft" | "mac" | "knowledge";
export type McpExposure = "direct" | "deferred" | "codemode" | "hidden";

export interface McpStdioConfig {
	command: string;
	args: string[];
	/** Values may be "${secret:KEY}" → resolved from SecretStore at connect time. */
	env: Record<string, string>;
	cwd?: string;
}

export interface McpHttpConfig {
	url: string;
	/** Values may be "${secret:KEY}". */
	headers: Record<string, string>;
	oauth?: { clientId?: string; clientName?: string; scope?: string; callbackPort?: number };
}

export interface Connection {
	id: ConnectionId;
	type: ConnectionType;
	/** MCP server name; tool names are mcp__<name>__<tool>. [A-Za-z0-9_-], unique. */
	name: string;
	label: string;
	description: string;
	icon: string;
	catalogId?: string;
	enabled: boolean;
	stdio?: McpStdioConfig;
	http?: McpHttpConfig;
	exposure: McpExposure;
	toolExposure: Record<string, McpExposure>;
	/** google/microsoft: enabled sub-services. mac: enabled capabilities (+ "folder:<abs path>" entries). */
	features: string[];
	account?: string;
	/** google/microsoft: OAuth client configured (client id stored in SecretStore). */
	configured?: boolean;
	createdAt: ISODate;
}

export type ToolDecision = "allow" | "ask" | "deny";

export interface ConnectionGrant {
	connectionId: ConnectionId;
	defaultDecision?: ToolDecision;
	toolRules: Record<string, ToolDecision>;
	/** mac: capabilities granted to this Dot (subset of the connection's features). google/microsoft: sub-services. Empty = all. */
	features?: string[];
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "needs-auth" | "error" | "disabled";

export interface ConnectionToolInfo {
	name: string;
	description: string;
	exposure: McpExposure;
	readOnly: boolean;
	destructive: boolean;
}

export interface ConnectionStatus {
	connectionId: ConnectionId;
	state: ConnectionState;
	toolCount: number;
	tools: ConnectionToolInfo[];
	error?: string;
	stderrTail?: string;
	checkedAt: ISODate;
}

export type CatalogCategory =
	| "productivity"
	| "dev"
	| "data"
	| "files"
	| "communication"
	| "knowledge"
	| "system"
	| "other";

export interface CatalogInput {
	key: string;
	label: string;
	secret: boolean;
	placeholder?: string;
	help?: string;
	target: "env" | "header" | "arg";
}

export interface CatalogEntry {
	id: string;
	label: string;
	description: string;
	category: CatalogCategory;
	icon: string;
	type: ConnectionType;
	stdio?: { command: string; args: string[]; env?: Record<string, string>; cwd?: string };
	http?: { url: string; headers?: Record<string, string>; oauth?: McpHttpConfig["oauth"] };
	inputs: CatalogInput[];
	defaultExposure: McpExposure;
	docsUrl?: string;
	requiresNode?: boolean;
	requiresUv?: boolean;
	verified: boolean;
}

/** A connector the user can pick when creating a Dot (spec 08 §5). */
export interface ConnectorChoice {
	/** Installed connection id (con_*), or a key like "google:gmail", "microsoft:mail", "mac:files", or a catalog id ("github"). */
	id: string;
	label: string;
	kind: "installed" | "available";
	icon: string;
	group: "Google" | "Microsoft" | "Mac" | "PC" | "MCP" | "Other";
	features?: string[];
}

// ───────────────────────── Dot Links (RBAC) ─────────────────────────
export type LinkApproval = "auto" | "ask";

export interface LinkSchedule {
	timeZone: string;
	/** 0=Sun … 6=Sat */
	days: number[];
	/** "HH:mm" 24h; end < start means the window crosses midnight */
	start: string;
	end: string;
}

export type LinkSubject =
	| { kind: "dot"; dotId: DotId }
	| { kind: "role"; role: string }
	| { kind: "super" }
	| { kind: "any" };

export interface DotLink {
	id: LinkId;
	from: LinkSubject;
	to: LinkSubject;
	effect: "allow" | "deny";
	enabled: boolean;
	approval: LinkApproval;
	schedule?: LinkSchedule;
	maxPerHour: number;
	sharePii: boolean;
	purpose: string;
	createdAt: ISODate;
}

export interface LinkDecision {
	allowed: boolean;
	approval?: LinkApproval;
	ruleId?: LinkId;
	reason: string;
	sharePii?: boolean;
	purpose?: string;
}

export interface LinkExchange {
	id: string;
	linkId?: LinkId;
	from: DotId;
	to: DotId;
	chain: DotId[];
	request: string;
	reply?: string;
	status: "pending-approval" | "running" | "done" | "rejected" | "error" | "timeout";
	error?: string;
	startedAt: ISODate;
	endedAt?: ISODate;
}

// ───────────────────────── Always-on ─────────────────────────
export type WatcherType =
	| "schedule"
	| "folder"
	| "url"
	| "rss"
	| "local-webhook"
	| "gmail"
	| "google-calendar"
	| "google-drive"
	| "outlook-mail"
	| "outlook-calendar"
	| "onedrive"
	| "teams-chat"
	| "mcp-resource"
	| "mcp-poll"
	| "mac-calendar"
	| "mac-reminders";

export type WatcherConfig = Record<string, string | number | boolean | string[] | number[]>;

export interface Watcher {
	id: WatcherId;
	dotId: DotId;
	type: WatcherType;
	label: string;
	enabled: boolean;
	config: WatcherConfig;
	intervalSec: number;
	cursor?: string;
	state: "idle" | "running" | "backoff" | "error" | "needs-auth" | "paused";
	failures: number;
	lastRunAt?: ISODate;
	lastEventAt?: ISODate;
	nextRunAt?: ISODate;
	lastError?: string;
	createdAt: ISODate;
}

export interface DotEvent {
	id: string;
	dotId: DotId;
	watcherId: WatcherId;
	type: WatcherType;
	title: string;
	body: string;
	facts: Record<string, string>;
	dedupeKey: string;
	importanceHint: "low" | "normal" | "high";
	occurredAt: ISODate;
	receivedAt: ISODate;
	status: "queued" | "delivered" | "handled" | "dropped-budget" | "dropped-duplicate";
}

export type DotEventView = Pick<
	DotEvent,
	"id" | "type" | "title" | "facts" | "importanceHint" | "occurredAt" | "status"
>;

export interface DotHealth {
	dotId: DotId;
	state: "running" | "idle" | "paused" | "backoff" | "error" | "over-budget" | "off";
	alwaysOn: boolean;
	sessionWarm: boolean;
	queuedEvents: number;
	turnsLastHour: number;
	costTodayUsd: number;
	watchers: Array<
		Pick<Watcher, "id" | "label" | "type" | "state" | "lastRunAt" | "nextRunAt" | "lastError" | "lastEventAt">
	>;
	lastError?: string;
	restarts: number;
}

// ───────────────────────── Memory ─────────────────────────
export interface MemoryItem {
	id: string;
	text: string;
	createdAt: ISODate;
	updatedAt: ISODate;
	source: "user" | "dot";
	pinned: boolean;
}
export interface DotMemory {
	items: MemoryItem[];
}
export interface UserMemory {
	items: MemoryItem[];
}

// ───────────────────────── Chat view model ─────────────────────────
export type ChatRole = "user" | "assistant" | "system" | "link-in" | "link-out" | "event";

export interface ToolCallView {
	id: string;
	name: string;
	label: string;
	connectionLabel?: string;
	args: unknown;
	argsPreview?: string;
	status: "preparing" | "pending-approval" | "running" | "done" | "error" | "blocked";
	resultPreview?: string;
	isError?: boolean;
	approvalId?: ApprovalId;
	startedAt: ISODate;
	endedAt?: ISODate;
	parentId?: string;
	/** Knowledge tools: the files the result came from (shown as citation chips). */
	sources?: KnowledgeSourceView[];
}

export type PiiType =
	| "EMAIL"
	| "PHONE"
	| "CARD"
	| "IBAN"
	| "SSN"
	| "IP"
	| "SECRET"
	| "PERSON"
	| "ADDRESS"
	| "CUSTOM"
	| "URL_CRED";

export const PII_TYPES: readonly PiiType[] = [
	"EMAIL",
	"PHONE",
	"CARD",
	"IBAN",
	"SSN",
	"IP",
	"SECRET",
	"PERSON",
	"ADDRESS",
	"CUSTOM",
	"URL_CRED",
];

export interface PeerStreamView {
	peerDotId: DotId;
	status: "queued" | "running" | "done" | "error" | "blocked";
	text: string;
	error?: string;
	seq: number;
}

export interface ChatMessageView {
	id: MessageId;
	dotId: DotId;
	role: ChatRole;
	text: string;
	thinking?: string;
	toolCalls: ToolCallView[];
	createdAt: ISODate;
	streaming: boolean;
	error?: string;
	peerDotId?: DotId;
	pii?: { count: number; types: PiiType[] };
	usage?: { input: number; output: number; costUsd?: number };
	queued?: "steer" | "followUp";
	events?: DotEventView[];
	importance?: "urgent" | "update" | "quiet";
	hidden?: boolean;
	timing?: { sentAt?: number; firstTokenAt?: number; endAt?: number };
	/** Fan-out sub-answers keyed by toolCallId then peer. */
	peerStreams?: Record<string, Record<string, PeerStreamView>>;
	/** For link-in/link-out exchanges. */
	exchangeId?: string;
	/** Set on SuperDot's daily briefing messages (rendered as a briefing card). */
	briefing?: { date: string; label: string };
	/** Files and images the user attached to this message. */
	attachments?: AttachmentView[];
}

export type DotStatus =
	| { kind: "idle" }
	| { kind: "thinking" }
	| { kind: "typing" }
	| { kind: "tool"; label: string }
	| { kind: "waiting-approval" }
	| { kind: "talking-to"; peerDotId: DotId }
	| { kind: "handling-events"; count: number }
	| { kind: "queued" }
	| { kind: "error"; message: string };

export type ChatEvent =
	| { type: "message-start"; dotId: DotId; message: ChatMessageView; clientNonce?: string }
	| { type: "message-update"; dotId: DotId; messageId: MessageId; seq: number; text: string; thinking?: string }
	| { type: "message-delta"; dotId: DotId; messageId: MessageId; seq: number; text?: string; thinking?: string }
	| { type: "message-end"; dotId: DotId; message: ChatMessageView }
	| { type: "tool-start"; dotId: DotId; messageId: MessageId; tool: ToolCallView }
	| { type: "tool-args-delta"; dotId: DotId; messageId: MessageId; toolCallId: string; seq: number; delta: string }
	| { type: "tool-update"; dotId: DotId; messageId: MessageId; tool: ToolCallView }
	| {
			type: "peer-stream";
			dotId: DotId;
			messageId: MessageId;
			toolCallId: string;
			peerDotId: DotId;
			status: PeerStreamView["status"];
			seq: number;
			delta?: string;
			text?: string;
			error?: string;
	  }
	| { type: "events-received"; dotId: DotId; events: DotEventView[] }
	| { type: "status"; dotId: DotId; status: DotStatus }
	| { type: "dot-updated"; dot: Dot }
	| { type: "error"; dotId: DotId; message: string; retryable: boolean };

// ───────────────────────── Approvals ─────────────────────────
export interface ApprovalRequest {
	id: ApprovalId;
	kind: "tool" | "link";
	dotId: DotId;
	title: string;
	detail: string;
	toolName?: string;
	args?: unknown;
	linkId?: LinkId;
	peerDotId?: DotId;
	/** The Dot's own explanation (what it said just before asking), when there is one. */
	why?: string;
	/** False when a persistent allow rule would have no effect (an explicit rule on the tool wins). Default true. */
	alwaysAllowable?: boolean;
	createdAt: ISODate;
	expiresAt: ISODate;
}

export type ApprovalDecision = "allow-once" | "allow-always" | "deny";
export type ApprovalResponse = {
	id: ApprovalId;
	decision: ApprovalDecision;
	/** Deny only: why, passed back to the Dot so it can adapt. */
	reason?: string;
	/** Allow only: the tool runs with these arguments instead of the Dot's. */
	editedArgs?: Record<string, unknown>;
};

export type ApprovalHistoryOutcome = "allowed" | "denied" | "edited" | "expired";

/** A decided approval, as shown in the inbox History tab. Summaries never hold message contents and are PII-masked. */
export interface ApprovalHistoryItem {
	id: string;
	approvalId?: string;
	at: ISODate;
	dotId?: DotId;
	outcome: ApprovalHistoryOutcome;
	/** you: answered in the inbox. rule: an Always allow rule. timeout: nobody answered. stopped: the Dot's run was stopped. */
	by: "you" | "rule" | "timeout" | "stopped";
	/** Allowed and remembered as an Always allow rule. */
	always?: boolean;
	hasReason?: boolean;
	kind: "tool" | "link";
	toolName?: string;
	summary: string;
}

// ───────────────────────── PII ─────────────────────────
export interface PiiSettings {
	enabledTypes: PiiType[];
	customTerms: Array<{ term: string; type: "CUSTOM" | "PERSON" | "ADDRESS" }>;
	detectNames: boolean;
}

// ───────────────────────── Audit ─────────────────────────
export type AuditKind =
	| "tool-call"
	| "tool-blocked"
	| "approval"
	| "link-exchange"
	| "link-blocked"
	| "pii-redaction"
	| "connection-change"
	| "settings-change"
	| "event";

export interface AuditEntry {
	id: string;
	at: ISODate;
	kind: AuditKind;
	dotId?: DotId;
	summary: string;
	data: Record<string, string | number | boolean | null>;
}

// ───────────────────────── Settings ─────────────────────────
export interface AppSettings {
	version: 1;
	theme: ThemeMode;
	accent: DotColor;
	defaultModel?: ModelRef;
	providers: ProviderSettings[];
	pii: PiiSettings;
	notifications: { enabled: boolean; sound: boolean; showPreview: boolean };
	links: { globalDailyBudget: number; maxDepth: number; replyTimeoutSec: number };
	runtime: { idleDisposeMinutes: number; maxConcurrentRuns: number };
	background: {
		runInBackground: boolean;
		launchAtLogin: boolean;
		hideDockWhenClosed: boolean;
		keepAwake: boolean;
		maxCostUsdPerDay: number;
		paused: boolean;
	};
	localWebhook: { enabled: boolean; port: number };
	onboardingDone: boolean;
	telemetry: false;
	/** Daily briefing by SuperDot. Optional so older settings files still load; read it with `resolveBriefing`. */
	briefing?: BriefingSettings;
	/** Global quick-ask bar. Absent in settings files from before the feature (defaults apply). */
	quickAsk?: QuickAskSettings;
}

export interface QuickAskSettings {
	enabled: boolean;
	/** Electron accelerator, one of the presets in shared/quickask.ts. */
	shortcut: string;
}

/** Daily briefing settings (docs/spec/13-superbot.md §6). */
export interface BriefingSettings {
	enabled: boolean;
	/** Local time of day, "HH:MM" (24 h). */
	time: string;
	days: "weekdays" | "daily";
	/** Per-Dot overrides. A Dot not listed contributes when it has a relevant connection. */
	dots: Record<string, boolean>;
	/** Extra instructions appended to the briefing prompt. */
	instructions: string;
}

export interface BriefingCandidate {
	dotId: DotId;
	name: string;
	/** The Dot has a connection a briefing can use (calendar, mail, ...). */
	relevant: boolean;
	/** Whether it contributes, after the user's overrides. */
	included: boolean;
}

export interface BriefingStatus {
	/** Local date (YYYY-MM-DD) of the last briefing, manual or scheduled. */
	lastRunDate?: string;
	nextRunAt?: ISODate;
	running: boolean;
	candidates: BriefingCandidate[];
}

export interface UiState {
	selectedDotId?: DotId;
	drafts: Record<string, string>;
	listWidth: number;
	drawerOpen: boolean;
	window?: { x: number; y: number; width: number; height: number };
}

// ───────────────────────── Dot creation ─────────────────────────
export interface SuggestedWatcher {
	type: WatcherType;
	label: string;
	config: WatcherConfig;
	intervalSec?: number;
}

export interface DotDraft {
	name: string;
	tagline: string;
	appearance: DotAppearance;
	persona: Persona;
	templateId?: string;
	model?: ModelRef;
	thinkingLevel?: ThinkingLevel;
	suggestedConnections: string[];
	roles?: string[];
	piiMode?: PiiMode;
	alwaysOn?: Partial<AlwaysOnSettings>;
	suggestedWatchers?: SuggestedWatcher[];
}

export interface DotTemplate {
	id: string;
	name: string;
	category: string;
	description: string;
	/** Example creation prompt shown as a chip in the New Dot dialog. */
	examplePrompt: string;
	draft: DotDraft;
}

export interface CreateDotInput {
	draft: DotDraft;
	creationPrompt?: string;
	connectors?: ConnectorChoice[];
	watchers?: SuggestedWatcher[];
}

export type DotPatch = Partial<
	Pick<
		Dot,
		| "name"
		| "tagline"
		| "appearance"
		| "persona"
		| "model"
		| "thinkingLevel"
		| "grants"
		| "roles"
		| "piiMode"
		| "alwaysOn"
		| "hiddenFromSuper"
		| "workspaceDir"
		| "pinned"
		| "muted"
		| "archived"
	>
> & { clearModel?: boolean };

export type AddProviderInput =
	| { kind: "cloud"; builtinProviderId: string; label?: string; apiKey: string }
	| { kind: "self-hosted"; preset: SelfHostedPreset; baseUrl: string; label?: string; apiKey?: string }
	| {
			kind: "custom-url";
			label: string;
			baseUrl: string;
			api: WireApi;
			apiKey?: string;
			headers?: Record<string, string>;
			models?: string[];
	  };

export type InstallConnectionInput =
	| { catalogId: string; inputs: Record<string, string>; name?: string }
	| {
			custom: {
				type: "mcp-stdio";
				name: string;
				label?: string;
				command: string;
				args: string[];
				env: Record<string, string>;
				secretEnv: Record<string, string>;
			};
	  }
	| {
			custom: {
				type: "mcp-http";
				name: string;
				label?: string;
				url: string;
				headers: Record<string, string>;
				secretHeaders: Record<string, string>;
			};
	  };

export type ConnectionPatch = Partial<
	Pick<Connection, "label" | "enabled" | "exposure" | "toolExposure" | "features" | "description">
> & {
	stdio?: Partial<McpStdioConfig>;
	http?: Partial<McpHttpConfig>;
	secrets?: Record<string, string>;
};

export type MacCapability =
	| "files"
	| "shell"
	| "calendar"
	| "reminders"
	| "contacts"
	| "notes"
	| "screen"
	| "clipboard"
	| "notifications"
	| "open"
	| "accessibility";

export const MAC_CAPABILITIES: readonly MacCapability[] = [
	"files",
	"shell",
	"calendar",
	"reminders",
	"contacts",
	"notes",
	"screen",
	"clipboard",
	"notifications",
	"open",
	"accessibility",
];

export interface MacPermissionStatus {
	capability: MacCapability;
	status: "granted" | "denied" | "not-determined" | "restricted" | "not-required";
	settingsUrl?: string;
}

export type UpsertLinkInput = Omit<DotLink, "id" | "createdAt"> & { id?: LinkId };

export interface OAuthClientInput {
	clientId: string;
	clientSecret?: string;
	features: string[];
}

export interface OpenDotErrorShape {
	code: string;
	message: string;
}

// ───────────────────────── Knowledge (local notes index) ─────────────────────────
export type KnowledgeFolderStatus = "queued" | "indexing" | "ready" | "error";

export interface KnowledgeFolderView {
	id: string;
	path: string;
	name: string;
	status: KnowledgeFolderStatus;
	fileCount: number;
	chunkCount: number;
	totalBytes: number;
	lastIndexedAt?: ISODate;
	/** While indexing: files handled so far out of the files that need work. */
	progress?: { done: number; total: number };
	error?: string;
	skipped: { pdf: number; tooLarge: number; other: number };
}

export interface KnowledgeState {
	folders: KnowledgeFolderView[];
}

/** A file a knowledge answer came from. */
export interface KnowledgeSourceView {
	path: string;
	name: string;
	heading?: string;
	startLine: number;
	endLine: number;
}
// ───────────────────────── Attachments ─────────────────────────
export type AttachmentKind = "image" | "text" | "file";

/** A file waiting in the composer (staged in the main process, referenced by id). */
export interface AttachmentDraft {
	id: string;
	name: string;
	kind: AttachmentKind;
	mime: string;
	size: number;
	/** Thumbnail URL for images (opendot-media protocol). */
	previewUrl?: string;
}

/** An attachment on a sent message, as shown in the chat. */
export interface AttachmentView {
	name: string;
	kind: AttachmentKind;
	mime?: string;
	size?: number;
	/** Workspace-relative path of the copy the Dot can read. */
	path?: string;
	/** Image URL (opendot-media protocol). */
	url?: string;
	truncated?: boolean;
	/** Image sent as a file reference only. */
	asReference?: boolean;
}

export type AttachmentStageResult =
	| { ok: true; attachment: AttachmentDraft }
	| { ok: false; name: string; error: string };
