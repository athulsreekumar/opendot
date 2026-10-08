# Spec 02 — Domain types, storage, IPC

## 1. `src/shared/types.ts` (verbatim — the single source of truth)

```ts
// ───────────────────────── Primitives ─────────────────────────
export type DotId = `dot_${string}`;
export type LinkId = `lnk_${string}`;
export type ConnectionId = `con_${string}`;
export type ApprovalId = `apr_${string}`;
export type MessageId = string; // pi entry ids or `msg_*` for local-only
export type ISODate = string; // new Date().toISOString()

export type ThemeMode = "light" | "dark" | "system";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

// ───────────────────────── Models / providers ─────────────────────────
export type ProviderKind = "cloud" | "self-hosted" | "custom-url";
export type WireApi = "openai-completions" | "openai-responses" | "anthropic-messages";

export interface ProviderSettings {
	/** Stable id used in pi, e.g. "anthropic", "ollama-local", "custom-acme". Lowercase, [a-z0-9-]. */
	id: string;
	kind: ProviderKind;
	label: string; // display name
	/** For cloud: pi built-in provider id (anthropic, openai, google, xai, groq, openrouter, mistral, deepseek, ...). */
	builtinProviderId?: string;
	/** For self-hosted / custom-url. */
	baseUrl?: string;
	api?: WireApi;
	/** Extra headers (values may contain ${ENV}); never secrets — secrets go to SecretStore under `provider:<id>`. */
	headers?: Record<string, string>;
	/** Model ids discovered or entered manually for self-hosted/custom providers. */
	models?: Array<{ id: string; label?: string; contextWindow?: number; vision?: boolean; reasoning?: boolean }>;
	/** Local = never leaves this machine (localhost/127.0.0.1/::1/.local). Computed, stored for display. */
	isLocal: boolean;
	enabled: boolean;
	hasSecret: boolean; // whether SecretStore holds a key for it (the key itself never leaves main)
	secretHint?: string; // last 4 chars of the key, for "••••1234" display
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
	/** One-paragraph role statement. "You are Inbox, an email triage assistant for …" */
	role: string;
	tone: Tone;
	/** 0 = terse, 100 = elaborate */
	verbosity: number;
	/** 0 = casual, 100 = formal */
	formality: number;
	/** 0 = never, 100 = frequently */
	emojiUsage: number;
	/** Short quirks, max 5, each max 80 chars. "Signs off with a 🌱" */
	quirks: string[];
	/** Things the Dot must always / never do. Max 10 each, 160 chars each. */
	dos: string[];
	donts: string[];
	/** Free-form extra instructions appended last. Max 4000 chars. */
	customInstructions: string;
	/** First message the Dot posts when created. */
	greeting: string;
}

export type PiiMode = "auto" | "always" | "off";

export interface DotAppearance {
	icon: string; // a key from src/shared/dot-icons.ts, e.g. "mail". Old files had `emoji`; migrated on load.
	color: DotColor; // one of the palette keys
}

export type DotColor =
	| "teal" | "green" | "lime" | "amber" | "orange" | "rose" | "pink" | "violet" | "indigo" | "blue" | "sky" | "slate";

export type DotKind = "standard" | "super";

export interface Dot {
	id: DotId;
	/** "super" = the single built-in SuperBot (spec 13). Exactly one exists; it can't be deleted. */
	kind: DotKind;
	name: string; // 1–32 chars
	tagline: string; // ≤ 60 chars, shown under name in Dot Info
	appearance: DotAppearance;
	persona: Persona;
	templateId?: string;
	/** What the user wrote when creating the Dot (spec 08 §5). */
	creationPrompt?: string;
	/** Connector ids chosen at creation that weren't installed yet; granted automatically once installed. */
	suggestedConnections: string[];
	/** undefined → use AppSettings.defaultModel */
	model?: ModelRef;
	thinkingLevel: ThinkingLevel;
	/** Connections this Dot may use. */
	grants: ConnectionGrant[];
	/** RBAC roles for Dot Links, lowercase [a-z0-9-], max 8. */
	roles: string[];
	piiMode: PiiMode;
	/** 24/7 mode: watchers + event handling while the app runs (spec 12). */
	alwaysOn: AlwaysOnSettings;
	/** What this Dot can do / knows, for the SuperBot directory (spec 13). Maintained by the app. */
	profile: DotProfile;
	/** If true, SuperBot can't ask this Dot or read its history. */
	hiddenFromSuper: boolean;
	/** Working folder for file/shell tools. Default: ~/.opendot/dots/<dotId>/workspace */
	workspaceDir: string;
	pinned: boolean;
	muted: boolean;
	archived: boolean;
	createdAt: ISODate;
	updatedAt: ISODate;
	/** Denormalised for the list pane. */
	lastActivityAt: ISODate;
	lastMessagePreview: string; // ≤ 120 chars, PII-restored, markdown stripped
	unreadCount: number;
}

// ───────────────────────── Connections ─────────────────────────
export type ConnectionType = "mcp-stdio" | "mcp-http" | "google" | "microsoft" | "mac";

export type McpExposure = "direct" | "deferred" | "codemode" | "hidden";

export interface McpStdioConfig {
	command: string;
	args: string[];
	env: Record<string, string>; // values may be "${secret:KEY}" → resolved from SecretStore at connect time
	cwd?: string;
}

export interface McpHttpConfig {
	url: string;
	headers: Record<string, string>; // values may be "${secret:KEY}"
	oauth?: { clientId?: string; clientName?: string; scope?: string; callbackPort?: number };
}

export interface Connection {
	id: ConnectionId;
	type: ConnectionType;
	/** MCP server name used in tool names mcp__<name>__<tool>. [A-Za-z0-9_-], unique. */
	name: string;
	label: string;
	description: string;
	icon: string; // lucide icon name or catalog asset key
	catalogId?: string;
	enabled: boolean;
	stdio?: McpStdioConfig;
	http?: McpHttpConfig;
	exposure: McpExposure; // default "deferred" (≤ 15 tools: "direct")
	toolExposure: Record<string, McpExposure>;
	/** google/microsoft: enabled sub-services. mac: enabled capabilities. */
	features: string[];
	/** google/microsoft account email after sign-in (display only). */
	account?: string;
	createdAt: ISODate;
}

export type ToolDecision = "allow" | "ask" | "deny";

export interface ConnectionGrant {
	connectionId: ConnectionId;
	/** Default decision for tools of this connection when no per-tool rule exists. undefined → annotation-based default. */
	defaultDecision?: ToolDecision;
	/** Per-tool overrides. Keys are full tool names (mcp__gmail__send) or patterns with *. */
	toolRules: Record<string, ToolDecision>;
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "needs-auth" | "error" | "disabled";

export interface ConnectionStatus {
	connectionId: ConnectionId;
	state: ConnectionState;
	toolCount: number;
	tools: Array<{ name: string; description: string; exposure: McpExposure; readOnly: boolean; destructive: boolean }>;
	error?: string;
	stderrTail?: string;
	checkedAt: ISODate;
}

export interface CatalogEntry {
	id: string; // "github", "notion", "filesystem", …
	label: string;
	description: string;
	category: "productivity" | "dev" | "data" | "files" | "communication" | "knowledge" | "system" | "other";
	icon: string;
	type: "mcp-stdio" | "mcp-http" | "google" | "microsoft" | "mac";
	stdio?: Omit<McpStdioConfig, "env"> & { env?: Record<string, string> };
	http?: Omit<McpHttpConfig, "headers"> & { headers?: Record<string, string> };
	/** Inputs the user must fill in when installing. */
	inputs: Array<{ key: string; label: string; secret: boolean; placeholder?: string; help?: string; target: "env" | "header" | "arg" }>;
	defaultExposure: McpExposure;
	docsUrl?: string;
	requiresNode?: boolean;
	requiresUv?: boolean;
	verified: boolean; // only verified entries are shown by default
}

// ───────────────────────── Dot Links (RBAC) ─────────────────────────
export type LinkApproval = "auto" | "ask";

export interface LinkSchedule {
	/** IANA tz, default system tz */
	timeZone: string;
	/** 0=Sun … 6=Sat */
	days: number[];
	/** "HH:mm" 24h; end < start means window crosses midnight */
	start: string;
	end: string;
}

/** Who a rule applies to. Roles are free-form labels on Dots (e.g. "assistant", "finance", "trusted"). */
export type LinkSubject = { kind: "dot"; dotId: DotId } | { kind: "role"; role: string } | { kind: "super" } | { kind: "any" };

export interface DotLink {
	id: LinkId;
	from: LinkSubject;
	to: LinkSubject;
	/** deny rules exist so a broad role allow can be carved out ("assistants may talk to anyone except Finance"). */
	effect: "allow" | "deny";
	enabled: boolean;
	approval: LinkApproval; // ignored for deny
	/** undefined = any time */
	schedule?: LinkSchedule;
	/** Max messages per (from Dot → to Dot) pair per rolling hour. 1–120. */
	maxPerHour: number;
	/** If false, the message is re-masked with the sender's PII tokens before the target sees it. */
	sharePii: boolean;
	/** Optional purpose shown to the target Dot. ≤ 200 chars. */
	purpose: string;
	createdAt: ISODate;
}

export interface LinkExchange {
	id: string;
	linkId: LinkId;
	from: DotId;
	to: DotId;
	chain: DotId[]; // call chain including from, to
	request: string; // restored text (for UI); stored only locally
	reply?: string;
	status: "pending-approval" | "running" | "done" | "rejected" | "error" | "timeout";
	error?: string;
	startedAt: ISODate;
	endedAt?: ISODate;
}

// ───────────────────────── Chat view model ─────────────────────────
export type ChatRole = "user" | "assistant" | "system" | "link-in" | "link-out" | "event";

export interface ToolCallView {
	id: string;
	name: string; // full tool name
	label: string; // humanised "Gmail · search"
	connectionLabel?: string;
	args: unknown; // PII-restored
	status: "preparing" | "pending-approval" | "running" | "done" | "error" | "blocked"; // preparing = args still streaming
	argsPreview?: string; // raw partial JSON while preparing (UI only)
	resultPreview?: string; // ≤ 2000 chars, restored
	isError?: boolean;
	approvalId?: ApprovalId;
	startedAt: ISODate;
	endedAt?: ISODate;
}

export interface ChatMessageView {
	id: MessageId;
	dotId: DotId;
	role: ChatRole;
	text: string; // markdown, PII-restored
	thinking?: string; // collapsed by default
	toolCalls: ToolCallView[];
	createdAt: ISODate;
	streaming: boolean;
	error?: string;
	/** For link-in/link-out: the other Dot. */
	peerDotId?: DotId;
	/** Count of PII items redacted when this message went to the model (types only). */
	pii?: { count: number; types: PiiType[] };
	usage?: { input: number; output: number; costUsd?: number };
	queued?: "steer" | "followUp";
	/** role "event": the events delivered in this batch. role "assistant" replying to events: importance parsed from the reply prefix. */
	events?: DotEventView[];
	importance?: "urgent" | "update" | "quiet";
	/** NO_UPDATE replies: kept for context, not shown in the timeline. */
	hidden?: boolean;
	/** Latency marks (ms since epoch) for the streaming budget (spec 14 §5). */
	timing?: { sentAt?: number; firstTokenAt?: number; endAt?: number };
}

export type DotStatus =
	| { kind: "idle" }
	| { kind: "thinking" }
	| { kind: "typing" }
	| { kind: "tool"; label: string }
	| { kind: "waiting-approval" }
	| { kind: "talking-to"; peerDotId: DotId }
	| { kind: "error"; message: string };

/** Events pushed main → renderer on channel "dot:event". */
export type ChatEvent =
	| { type: "message-start"; dotId: DotId; message: ChatMessageView; clientNonce?: string }
	/** Snapshot (full text). Sent every 1 s while streaming and once at the end; it resyncs any missed deltas (spec 14). */
	| { type: "message-update"; dotId: DotId; messageId: MessageId; seq: number; text: string; thinking?: string }
	/** Token-level append. `seq` increases by 1 per message; on a gap the renderer waits for the next snapshot. */
	| { type: "message-delta"; dotId: DotId; messageId: MessageId; seq: number; text?: string; thinking?: string }
	/** Streaming tool-call arguments (raw partial JSON) before the tool starts. */
	| { type: "tool-args-delta"; dotId: DotId; messageId: MessageId; toolCallId: string; seq: number; delta: string }
	/** A sub-answer streaming from another Dot inside message_dot / ask_dots (spec 13 §5). */
	| { type: "peer-stream"; dotId: DotId; toolCallId: string; peerDotId: DotId; status: "queued" | "running" | "done" | "error" | "blocked"; seq: number; delta?: string; text?: string; error?: string }
	| { type: "events-received"; dotId: DotId; events: DotEventView[] }
	| { type: "message-end"; dotId: DotId; message: ChatMessageView }
	| { type: "tool-start"; dotId: DotId; messageId: MessageId; tool: ToolCallView }
	| { type: "tool-update"; dotId: DotId; messageId: MessageId; tool: ToolCallView }
	| { type: "status"; dotId: DotId; status: DotStatus }
	| { type: "dot-updated"; dot: Dot }
	| { type: "error"; dotId: DotId; message: string; retryable: boolean };

// ───────────────────────── Approvals ─────────────────────────
export interface ApprovalRequest {
	id: ApprovalId;
	kind: "tool" | "link";
	dotId: DotId;
	title: string; // "Inbox wants to send an email"
	detail: string; // humanised args summary (restored)
	toolName?: string;
	args?: unknown; // restored
	linkId?: LinkId;
	peerDotId?: DotId;
	createdAt: ISODate;
	expiresAt: ISODate; // default +5 min
}

export type ApprovalResponse = { id: ApprovalId; decision: "allow-once" | "allow-always" | "deny" };

// ───────────────────────── PII ─────────────────────────
export type PiiType =
	| "EMAIL" | "PHONE" | "CARD" | "IBAN" | "SSN" | "IP" | "SECRET" | "PERSON" | "ADDRESS" | "CUSTOM" | "URL_CRED";

export interface PiiSettings {
	enabledTypes: PiiType[]; // default all except PERSON, ADDRESS
	customTerms: Array<{ term: string; type: "CUSTOM" | "PERSON" | "ADDRESS" }>; // e.g. user's name, home address
	detectNames: boolean; // compromise NER, default false
}

// ───────────────────────── Audit ─────────────────────────
export type AuditKind =
	| "tool-call" | "tool-blocked" | "approval" | "link-exchange" | "link-blocked" | "pii-redaction" | "connection-change" | "settings-change";

export interface AuditEntry {
	id: string;
	at: ISODate;
	kind: AuditKind;
	dotId?: DotId;
	summary: string; // never contains PII values or secrets
	data: Record<string, string | number | boolean | null>; // flat, scrubbed
}

// ───────────────────────── Settings ─────────────────────────
export interface AppSettings {
	version: 1;
	theme: ThemeMode;
	accent: DotColor; // app accent, default "teal"
	defaultModel?: ModelRef;
	providers: ProviderSettings[];
	pii: PiiSettings;
	notifications: { enabled: boolean; sound: boolean; showPreview: boolean };
	links: { globalDailyBudget: number; maxDepth: number; replyTimeoutSec: number }; // 200, 3, 120
	runtime: { idleDisposeMinutes: number; maxConcurrentRuns: number }; // 15, 4
	background: {
		runInBackground: boolean;   // closing the window keeps Dots running (default true)
		launchAtLogin: boolean;     // default true after onboarding opt-in
		hideDockWhenClosed: boolean; // default false
		keepAwake: boolean;         // powerSaveBlocker while always-on Dots exist (default false)
		maxCostUsdPerDay: number;   // global cap across all Dots, default 10
		paused: boolean;            // "Pause all Dots" from the tray
	};
	localWebhook: { enabled: boolean; port: number }; // default false, 47615
	onboardingDone: boolean;
	window?: { x: number; y: number; width: number; height: number; listWidth: number };
	telemetry: false; // OpenDot never sends telemetry. Literal false on purpose.
}
```


### 1.1 Always-on, SuperBot and runtime types (append to `types.ts`)

```ts
export type WatcherId = `wat_${string}`;

export interface AlwaysOnSettings {
	enabled: boolean;
	/** What the Dot should do when events arrive. ≤ 2000 chars. "Tell me only about emails from clients or anything urgent." */
	standingInstructions: string;
	/** Which replies to events become native notifications. */
	notify: "urgent" | "updates" | "none";
	/** Events still get processed in quiet hours, but notifications are held (urgent ones still go through). */
	quietHours?: LinkSchedule;
	/** Events arriving within this window are delivered together as one batch. 0–300 s, default 10. */
	batchWindowSec: number;
	budget: { maxTurnsPerHour: number; maxCostUsdPerDay: number }; // defaults 20, 2.00 (local models: cost ignored)
}

export type WatcherType =
	| "schedule" | "folder" | "url" | "rss" | "local-webhook"
	| "gmail" | "google-calendar" | "google-drive"
	| "outlook-mail" | "outlook-calendar" | "onedrive" | "teams-chat"
	| "mcp-resource" | "mcp-poll"
	| "mac-calendar" | "mac-reminders";

export interface Watcher {
	id: WatcherId;
	dotId: DotId;
	type: WatcherType;
	label: string;
	enabled: boolean;
	/** Type-specific, validated by the source's zod schema (spec 12 §4). */
	config: Record<string, string | number | boolean | string[]>;
	/** Poll interval for polling sources; ignored by push sources. Min 15, default 60. */
	intervalSec: number;
	/** Source cursor (Gmail historyId, Graph deltaLink, Drive pageToken, content hash, …). Opaque. */
	cursor?: string;
	state: "idle" | "running" | "backoff" | "error" | "needs-auth" | "paused";
	lastRunAt?: ISODate;
	lastEventAt?: ISODate;
	nextRunAt?: ISODate;
	lastError?: string;
	createdAt: ISODate;
}

export interface DotEvent {
	id: string; // evt_*
	dotId: DotId;
	watcherId: WatcherId;
	type: WatcherType;
	/** ≤ 140 chars, shown on the event card. */
	title: string;
	/** Model-facing body, ≤ 4000 chars. */
	body: string;
	/** Small structured facts for the UI (sender, link, path…). Flat. */
	facts: Record<string, string>;
	dedupeKey: string;
	importanceHint: "low" | "normal" | "high";
	occurredAt: ISODate;
	receivedAt: ISODate;
	status: "queued" | "delivered" | "handled" | "dropped-budget" | "dropped-duplicate";
}
export type DotEventView = Pick<DotEvent, "id" | "type" | "title" | "facts" | "importanceHint" | "occurredAt" | "status">;

export interface DotProfile {
	/** One line per capability, generated from grants + watchers. "Reads and drafts Gmail". */
	capabilities: string[];
	/** Watcher labels, e.g. "Gmail inbox (every 30 s)". */
	dataSources: string[];
	/** ≤ 120 words the Dot wrote about what it currently tracks/knows (spec 13 §3). */
	knowledgeSummary: string;
	updatedAt: ISODate;
}

export interface DotHealth {
	dotId: DotId;
	state: "running" | "idle" | "paused" | "backoff" | "error" | "over-budget" | "off";
	alwaysOn: boolean;
	sessionWarm: boolean;
	queuedEvents: number;
	turnsLastHour: number;
	costTodayUsd: number;
	watchers: Array<Pick<Watcher, "id" | "label" | "type" | "state" | "lastRunAt" | "nextRunAt" | "lastError" | "lastEventAt">>;
	lastError?: string;
	restarts: number;
}
```

IPC additions (add to `OpenDotApi`, `INVOKE_CHANNELS` and `EVENT_CHANNELS`):
```ts
watchers: {
	list(dotId?: DotId): Promise<Watcher[]>;
	create(input: { dotId: DotId; type: WatcherType; label?: string; config: Watcher["config"]; intervalSec?: number }): Promise<Watcher>;
	update(id: WatcherId, patch: Partial<Pick<Watcher, "label" | "enabled" | "config" | "intervalSec">>): Promise<Watcher>;
	remove(id: WatcherId): Promise<void>;
	test(input: { type: WatcherType; config: Watcher["config"]; dotId: DotId }): Promise<{ ok: boolean; message: string; sample?: DotEventView[] }>;
	runNow(id: WatcherId): Promise<void>;
	webhookInfo(id: WatcherId): Promise<{ url: string; token: string; curl: string }>; // local-webhook only
};
events: { list(dotId: DotId, opts?: { before?: ISODate; limit?: number }): Promise<DotEventView[]> };
runtime: {
	health(): Promise<DotHealth[]>;
	pauseAll(paused: boolean): Promise<void>;
	setAlwaysOn(dotId: DotId, enabled: boolean): Promise<Dot>;
};
superbot: {
	get(): Promise<Dot>;                          // the super Dot
	directory(): Promise<Array<{ dotId: DotId; name: string; card: string }>>; // what Super sees (spec 13 §2)
	refreshProfiles(): Promise<void>;
};
// channels: "watchers.list", "watchers.create", "watchers.update", "watchers.remove", "watchers.test", "watchers.runNow",
// "watchers.webhookInfo", "events.list", "runtime.health", "runtime.pauseAll", "runtime.setAlwaysOn",
// "superbot.get", "superbot.directory", "superbot.refreshProfiles"
// EventMap additions:
//   "runtime:health": DotHealth          (pushed on every state change, throttled 1/s per Dot)
//   "watcher:changed": Watcher
```
Storage: see §2 (`watchers.json`, `dots/<dotId>/events.jsonl`, `dots/<dotId>/dedupe/`, `usage.json`).

## 2. Storage layout — everything lives in `~/.opendot/` on the user's machine

Root: `path.join(os.homedir(), ".opendot")`, overridable with `OPENDOT_DATA_DIR` (tests). Created with mode `0700` on first run.
Nothing is stored anywhere else (no Application Support, no cloud). Config and memory are plain **JSON** files. Append-only
logs and pi conversation transcripts use **JSONL** (one JSON object per line). That is pi's native, crash-safe session format,
and every line is plain JSON the user can read.

```
~/.opendot/
├─ settings.json             { version, data: AppSettings }
├─ connections.json          { version, data: Connection[] }
├─ links.json                { version, data: DotLink[] }
├─ watchers.json             { version, data: Watcher[] }
├─ policy.json               { version, data: { rules: PersistedToolRule[] } }   // "allow always" decisions
├─ usage.json                per-Dot turns/cost buckets (spec 12 §2.2)
├─ memory.json               { version, data: UserMemory }   // "About me", shared by all Dots (§2.1)
├─ ui-state.json             { selectedDotId, drafts: {dotId: text}, listWidth, drawerOpen }   // restored on launch
├─ link-exchanges.jsonl      LinkExchange per line
├─ dots/<dotId>/
│  ├─ dot.json               { version, data: Dot }
│  ├─ memory.json            { version, data: DotMemory }   // this Dot's long-term memory (§2.1)
│  ├─ sessions/              pi SessionManager dir for the main chat (*.jsonl); continueRecent() resumes it after restart
│  ├─ sessions/archive/      chats moved here by "Clear chat"
│  ├─ links/<peerDotId>/     pi session dir per sender (Dot Links / SuperBot)
│  ├─ events.jsonl           DotEvent per line, pruned to 30 days
│  ├─ dedupe/<watcherId>.json
│  ├─ pii.vault              encrypted PII token vault (spec 06 §5.3)
│  └─ workspace/             default working folder for the Dot's file/shell tools
├─ audit/audit.jsonl         AuditEntry per line, rotated at 5 MB (keep 5)
├─ secrets.bin               safeStorage-encrypted JSON (API keys, OAuth tokens)
├─ pi/                       PI_CODING_AGENT_DIR for OpenDot: models.json (empty), mcp-auth.json (0600), mcp.log
└─ logs/main.log             electron-log (no payloads)
```
The `dots` collection is a directory of `dot.json` files, one per Dot (not one big file). Deleting a Dot moves `dots/<dotId>/` to
`~/.opendot/trash/<dotId>-<epoch>/` (purged after 30 days), so an accidental delete is recoverable by hand.
Every JSON file is written atomically (temp file + rename) and pretty-printed with 2-space indentation, so it stays human-readable.

### 2.1 Memory (persistent, JSON)

```ts
export interface MemoryItem { id: string; text: string; createdAt: ISODate; updatedAt: ISODate; source: "user" | "dot"; pinned: boolean }
export interface DotMemory { items: MemoryItem[] }      // ≤ 200 items, each ≤ 500 chars
export interface UserMemory { items: MemoryItem[] }     // "About me": name, preferences, people, projects. ≤ 100 items
```
- Every Dot session gets two prompt sections each turn (`systemPromptOptions.sections`, spec 08 §3): `about_user` (UserMemory, ≤ 4000 chars,
  pinned first) and `memory` (this Dot's DotMemory, ≤ 6000 chars, pinned first, then newest). When over the limit, the oldest unpinned items are left out
  of the prompt (not deleted).
- Tools registered on every Dot (`src/main/runtime/extensions/memory.ts`):
  `remember({ text, about?: "user" | "dot" })` (allow; `about: "user"` writes UserMemory and is shared with all Dots),
  `forget({ id })` (allow), `recall({ query })` (allow; local term search over both memories, for when the prompt was truncated).
- Persona guidance (base block, spec 08 §3): "When the user tells you a durable fact or preference, save it with remember. Don't save secrets."
- PII: memory is stored in plain text locally (it's the user's machine). It goes through the PII `context` redaction before reaching cloud models like any other text.
- UI: Dot Info → **Memory** section (list with edit/pin/delete, "Add memory"); Settings → **About me** (UserMemory editor).
- IPC: `memory.get(dotId | "user")`, `memory.upsert(dotId | "user", item)`, `memory.remove(dotId | "user", id)` (add to `OpenDotApi` + channels).

`JsonFile<T>` contract (`src/main/store/json-file.ts`):

```ts
export class JsonFile<T> {
	constructor(opts: { path: string; schema: z.ZodType<T>; defaults: () => T; version: number; migrate?: (raw: unknown, fromVersion: number) => T });
	read(): Promise<T>; // cached after first read
	write(next: T): Promise<void>; // atomic, queued
	update(fn: (cur: T) => T): Promise<T>; // read-modify-write inside the queue
}
```
On a parse or validation failure: rename to `<file>.corrupt-<epoch>`, log a warning, return `defaults()`.

`Store` (`src/main/store/store.ts`) exposes `settings`, `dots`, `links`, `connections`, `policy`
(JsonFile instances) plus `audit.append(entry)`, `audit.query({ dotId?, kinds?, from?, to?, limit, before? })`,
and `exchanges.append/get/list`.

## 3. IPC

### 3.1 Principles
- Renderer → main: `ipcRenderer.invoke(channel, payload)` only. Every payload is validated with zod in main.
- Main → renderer: `webContents.send(eventChannel, payload)`, broadcast to all windows.
- Errors cross IPC as `{ code: string; message: string }` thrown objects. The preload re-throws them as `OpenDotError`.
- **Secrets never cross to the renderer.** `providers.setSecret` is write-only.

### 3.2 `src/shared/ipc.ts`

```ts
import type { /* all types used below */ } from "./types";

export interface OpenDotApi {
	app: {
		info(): Promise<{ version: string; dataDir: string; platform: string; piVersion: string }>;
		openExternal(url: string): Promise<void>; // https/mailto only
		revealDataDir(): Promise<void>;
		pickFolder(opts?: { title?: string }): Promise<string | undefined>; // dialog.showOpenDialog openDirectory
		revealPath(path: string): Promise<void>;
		setLaunchAtLogin(on: boolean): Promise<void>;
		reset(): Promise<void>; // wipes data dir (after renderer confirmation) and relaunches
	};
	settings: {
		get(): Promise<AppSettings>;
		update(patch: Partial<Omit<AppSettings, "version" | "providers" | "telemetry">>): Promise<AppSettings>;
	};
	models: {
		listProviders(): Promise<ProviderSettings[]>;
		builtinProviders(): Promise<Array<{ id: string; label: string; keyUrl?: string }>>;
		addProvider(input: AddProviderInput): Promise<ProviderSettings>;
		updateProvider(id: string, patch: Partial<Pick<ProviderSettings, "label" | "baseUrl" | "headers" | "enabled" | "models" | "api">>): Promise<ProviderSettings>;
		removeProvider(id: string): Promise<void>;
		setSecret(providerId: string, secret: string): Promise<void>;
		clearSecret(providerId: string): Promise<void>;
		discover(providerId: string): Promise<Array<{ id: string; label?: string }>>;
		test(providerId: string, modelId?: string): Promise<{ ok: boolean; latencyMs?: number; message: string }>;
		listModels(): Promise<ModelOption[]>;
		detectLocal(): Promise<Array<{ preset: "ollama" | "lmstudio" | "llamacpp" | "vllm"; baseUrl: string }>>;
	};
	dots: {
		list(): Promise<Dot[]>;
		get(id: DotId): Promise<Dot>;
		create(input: CreateDotInput): Promise<Dot>;
		update(id: DotId, patch: DotPatch): Promise<Dot>;
		remove(id: DotId): Promise<void>;
		duplicate(id: DotId): Promise<Dot>; // config + grants, not history; name "<Name> copy"
		markRead(id: DotId): Promise<void>;
		templates(): Promise<DotTemplate[]>;
		draftFromDescription(input: { prompt: string; connectors: ConnectorChoice[] }, requestId?: string): Promise<DotDraft>; // streams via "dots:draft-stream"
		connectorChoices(): Promise<ConnectorChoice[]>; // installed connections + available native/catalog connectors for the picker
		status(id: DotId): Promise<DotStatus>;
	};
	chat: {
		history(dotId: DotId, opts?: { before?: MessageId; limit?: number }): Promise<{ messages: ChatMessageView[]; hasMore: boolean }>;
		send(dotId: DotId, text: string, opts?: { mode?: "auto" | "steer" | "followUp"; clientNonce?: string }): Promise<{ accepted: true; queued?: "steer" | "followUp" }>;
		abort(dotId: DotId): Promise<void>;
		clear(dotId: DotId): Promise<void>; // starts a new pi session; old file kept in sessions/<dotId>/archive
		linkHistory(dotId: DotId, peerDotId: DotId): Promise<ChatMessageView[]>; // the link session where peer asked dotId
	};
	connections: {
		catalog(): Promise<CatalogEntry[]>;
		list(): Promise<Connection[]>;
		install(input: InstallConnectionInput): Promise<Connection>;
		importJson(json: string): Promise<{ added: Connection[]; errors: string[] }>; // Claude Desktop / Cursor mcpServers format
		update(id: ConnectionId, patch: ConnectionPatch): Promise<Connection>;
		remove(id: ConnectionId): Promise<void>;
		status(id?: ConnectionId): Promise<ConnectionStatus[]>;
		check(id: ConnectionId): Promise<ConnectionStatus>; // connect, list tools, disconnect
		signIn(id: ConnectionId): Promise<{ account?: string }>; // OAuth (google/microsoft/mcp-http)
		signOut(id: ConnectionId): Promise<void>;
		macPermissions(): Promise<MacPermissionStatus[]>;
		requestMacPermission(cap: MacCapability): Promise<MacPermissionStatus>;
		nodeAvailable(): Promise<{ node?: string; npx: boolean; uvx: boolean }>;
	};
	approvals: {
		pending(): Promise<ApprovalRequest[]>;
		respond(res: ApprovalResponse): Promise<void>;
	};
	links: {
		list(): Promise<DotLink[]>;
		upsert(input: UpsertLinkInput): Promise<DotLink>;
		remove(id: LinkId): Promise<void>;
		exchanges(opts?: { dotId?: DotId; limit?: number }): Promise<LinkExchange[]>;
		simulate(from: DotId, to: DotId, at?: ISODate): Promise<LinkDecision>;
	};
	pii: {
		preview(text: string, dotId?: DotId): Promise<{ redacted: string; items: Array<{ type: PiiType; start: number; end: number }> }>;
	};
	audit: {
		query(q: { dotId?: DotId; kinds?: AuditKind[]; before?: ISODate; limit?: number }): Promise<AuditEntry[]>;
		exportJsonl(): Promise<{ path: string }>; // writes to ~/Downloads, returns path
	};
	on<E extends keyof EventMap>(event: E, listener: (payload: EventMap[E]) => void): () => void;
}

export interface EventMap {
	"dot:event": ChatEvent;
	"approval:requested": ApprovalRequest;
	"approval:resolved": { id: ApprovalId; decision: ApprovalResponse["decision"] | "expired" };
	"connection:status": ConnectionStatus;
	"link:exchange": LinkExchange;
	"settings:changed": AppSettings;
	"dots:changed": Dot[];
	"app:focus-dot": { dotId: DotId }; // from notification click
	"dots:draft-stream": { requestId: string; delta: string };
	"runtime:health": DotHealth;
	"watcher:changed": Watcher;
}

export type AddProviderInput =
	| { kind: "cloud"; builtinProviderId: string; label?: string; apiKey: string }
	| { kind: "self-hosted"; preset: "ollama" | "lmstudio" | "llamacpp" | "vllm"; baseUrl: string; label?: string; apiKey?: string }
	| { kind: "custom-url"; label: string; baseUrl: string; api: WireApi; apiKey?: string; headers?: Record<string, string>; models?: string[] };

export type CreateDotInput = { draft: DotDraft; creationPrompt?: string; connectors?: ConnectorChoice[]; watchers?: DotDraft["suggestedWatchers"] };
export interface DotDraft {
	name: string; tagline: string; appearance: DotAppearance; persona: Persona;
	templateId?: string; model?: ModelRef; thinkingLevel?: ThinkingLevel;
	suggestedConnections: string[]; // catalog ids / connection types the template wants
	roles?: string[];
	alwaysOn?: Partial<AlwaysOnSettings>;
	/** Watchers offered (pre-ticked) in the Review step; created only if their connection is installed. */
	suggestedWatchers?: Array<{ type: WatcherType; label: string; config: Watcher["config"]; intervalSec?: number }>;
	piiMode?: PiiMode;
}
export type DotPatch = Partial<Pick<Dot, "name" | "tagline" | "appearance" | "persona" | "model" | "thinkingLevel" | "grants" | "roles" | "piiMode" | "workspaceDir" | "pinned" | "muted" | "archived">>;
export interface DotTemplate { id: string; name: string; category: string; description: string; draft: DotDraft }

export type InstallConnectionInput =
	| { catalogId: string; inputs: Record<string, string>; name?: string }
	| { custom: { type: "mcp-stdio"; name: string; label?: string; command: string; args: string[]; env: Record<string, string>; secretEnv: Record<string, string> } }
	| { custom: { type: "mcp-http"; name: string; label?: string; url: string; headers: Record<string, string>; secretHeaders: Record<string, string> } };
export type ConnectionPatch = Partial<Pick<Connection, "label" | "enabled" | "exposure" | "toolExposure" | "features" | "description">> & {
	stdio?: Partial<McpStdioConfig>; http?: Partial<McpHttpConfig>; secrets?: Record<string, string>;
};

export type MacCapability = "files" | "shell" | "calendar" | "reminders" | "contacts" | "notes" | "screen" | "clipboard" | "notifications" | "open" | "accessibility";
export interface MacPermissionStatus { capability: MacCapability; status: "granted" | "denied" | "not-determined" | "restricted" | "not-required"; settingsUrl?: string }

export interface LinkDecision { allowed: boolean; approval?: LinkApproval; ruleId?: LinkId; reason: string }
export type UpsertLinkInput = Omit<DotLink, "id" | "createdAt"> & { id?: LinkId };

/** Channel names. Invoke channels are "<ns>.<method>", e.g. "dots.create". */
export const INVOKE_CHANNELS = [
	"app.info", "app.openExternal", "app.revealDataDir", "app.pickFolder", "app.revealPath", "app.setLaunchAtLogin", "app.reset",
	"settings.get", "settings.update",
	"models.listProviders", "models.builtinProviders", "models.addProvider", "models.updateProvider", "models.removeProvider",
	"models.setSecret", "models.clearSecret", "models.discover", "models.test", "models.listModels", "models.detectLocal",
	"dots.list", "dots.get", "dots.create", "dots.update", "dots.remove", "dots.duplicate", "dots.markRead", "dots.templates", "dots.draftFromDescription", "dots.connectorChoices", "dots.status",
	"chat.history", "chat.send", "chat.abort", "chat.clear", "chat.linkHistory",
	"connections.catalog", "connections.list", "connections.install", "connections.importJson", "connections.update", "connections.remove",
	"connections.status", "connections.check", "connections.signIn", "connections.signOut", "connections.macPermissions", "connections.requestMacPermission", "connections.nodeAvailable",
	"approvals.pending", "approvals.respond",
	"links.list", "links.upsert", "links.remove", "links.exchanges", "links.simulate",
	"pii.preview",
	"audit.query", "audit.exportJsonl",
] as const;
export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];
export const EVENT_CHANNELS = ["dot:event", "approval:requested", "approval:resolved", "connection:status", "link:exchange", "settings:changed", "dots:changed", "app:focus-dot", "dots:draft-stream", "runtime:health", "watcher:changed"] as const;
```

### 3.3 Preload (`src/preload/index.ts`)

Builds `OpenDotApi` generically: for every `INVOKE_CHANNELS` entry `"ns.method"`, set
`api[ns][method] = (...args) => ipcRenderer.invoke(channel, args)`. `on(event, listener)` checks the
event is in `EVENT_CHANNELS`, adds an `ipcRenderer.on` listener, and returns an unsubscribe function.
Expose it with `contextBridge.exposeInMainWorld("opendot", api)`.
`src/renderer/src/env.d.ts`: `declare global { interface Window { opendot: OpenDotApi } }`.

Main side: `registerIpc(handlers)` where `handlers: { [C in InvokeChannel]: (...args) => Promise<unknown> }`.
Args arrive as an array. Validate with `ARG_SCHEMAS[channel]` (a zod tuple), then call the handler.
Wrap thrown errors into `{ code, message }`. Never forward stack traces.

### 3.4 Validation schemas (`src/shared/schemas.ts`)

One zod schema per input type above (`DotId = z.string().regex(/^dot_[A-Za-z0-9_-]{12}$/)`, etc.)
and `ARG_SCHEMAS: Record<InvokeChannel, z.ZodTuple>`. Text limits: chat message ≤ 100 000 chars,
names ≤ 32, persona fields as documented in types. URLs: `z.url()` restricted to `http:`/`https:`.

### 3.5 Renderer stores contract

- `stores/dots.ts`: `{ dots: Dot[]; statuses: Record<DotId, DotStatus>; selectedId?: DotId; load(); select(id); create(draft); update(id, patch); remove(id) }`. It subscribes to `dots:changed` and to `dot:event` (`status`, `dot-updated`).
- `stores/chat.ts`: `{ byDot: Record<DotId, { messages: ChatMessageView[]; hasMore: boolean; loading: boolean }>; loadHistory(dotId); loadMore(dotId); send(dotId, text); abort(dotId) }`. It applies `dot:event`:
  - `message-start` → append (or replace by id)
  - `message-delta` → if `seq === lastSeq + 1`, append `text`/`thinking`; if `seq <= lastSeq`, ignore; on a gap, set `needsResync` and ignore deltas until the next snapshot
  - `message-update` (snapshot) → if `seq >= lastSeq`, replace `text`/`thinking` with the full text, set `lastSeq = seq`, clear `needsResync`
  - `tool-args-delta` → append to that tool's `argsPreview` (string, UI only); `peer-stream` → upsert into `peerStreams[toolCallId][peerDotId]`
  - `events-received` → append a role `event` message (or merge into the open event batch message)
  - Streaming updates must touch only the affected message object (spec 14 §4)
  - `message-end` → replace with the final message, `streaming=false`
  - `tool-start` / `tool-update` → upsert into `message.toolCalls` by `tool.id`
- `stores/approvals.ts`: the pending list, fed by `approval:requested` / `approval:resolved`.
- `lib/api.ts`: `export const api = window.opendot;` plus `isOpenDotError(e)`.
