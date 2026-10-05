# Spec 03 — pi runtime: DotHost, DotRuntime, events

pi reference (read from `node_modules/@earendil-works/pi-coding-agent/docs/` when unsure):
`sdk.md`, `extensions.md`, `mcp.md`, `models.md`, `session-format.md`, `message-types.md`.
Verified against `@earendil-works/pi-coding-agent@1.0.2`.

## 1. `pi-adapter.ts` — the only file that imports pi directly

Every other main file imports pi symbols **from `./pi-adapter`**, so an API change in pi is fixed
in one place. Re-export exactly what we use:

```ts
export {
	createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, ModelRuntime,
	createMcpExtension, createCodemodeExtension, createToolSearchExtension, defineTool,
} from "@earendil-works/pi-coding-agent";
export type {
	AgentSession, AgentSessionEvent, ExtensionAPI, ExtensionFactory, ExtensionContext, ToolDefinition,
	ToolCallEvent, ContextEvent, LoadedMcpConfig, McpServerEntry, McpServerConfig, InlineExtension,
} from "@earendil-works/pi-coding-agent";
export { Type, StringEnum } from "@earendil-works/pi-ai";
export const PI_VERSION = "1.0.2";
```
If a symbol is not exported under that name, find it in `dist/index.d.ts` and adapt **here**.
(`InlineExtension` is exported by pi 1.0.2: `ExtensionFactory | { name: string; factory: ExtensionFactory; hidden?: boolean; … }`.
OpenDot always uses the named object form, `{ name: "opendot-<x>", factory, hidden: true }`, so errors name the extension.)

## 2. One ModelRuntime for the whole app (owned by ModelService, spec 04)

**Process env, set at the very top of `src/main/index.ts` before anything imports pi.** pi reads
these when its modules initialise, so `services.ts` (which imports pi) must be loaded with a dynamic
`await import("./services")` *after* these lines:

```ts
process.env.PI_CODING_AGENT_DIR = paths.piDir;   // isolate from the user's own ~/.pi/agent (mcp-auth.json, mcp.log, auth.json)
process.env.PI_TELEMETRY = "0";                   // no install telemetry / attribution headers
process.env.PI_SKIP_VERSION_CHECK = "1";          // no pi.dev version ping
```
`paths.ts` must therefore not import pi. (Model catalog refreshes stay on, because they keep cloud model lists current.)

```ts
const modelRuntime = await ModelRuntime.create({
	authPath: join(paths.piDir, "auth.json"),   // stays empty: we never call login() in v1
	modelsPath: join(paths.piDir, "models.json"), // written as {"providers":{}}; custom providers are registered in code
});
```
API keys: `await modelRuntime.setRuntimeApiKey(providerId, key)` at startup for every provider
with a secret, and again on `models.setSecret`. Runtime keys are held in memory only.
Custom/self-hosted providers: `modelRuntime.registerProvider(id, ProviderConfigInput)` (spec 04 §3).

## 3. DotHost — one per Dot (`dot-host.ts`)

```ts
export class DotHost {
	constructor(deps: DotHostDeps, dot: Dot);
	readonly dotId: DotId;
	get status(): DotStatus;
	ensureSession(): Promise<AgentSession>;        // lazy create (§4)
	send(text: string, mode: "auto" | "steer" | "followUp", clientNonce?: string): Promise<{ queued?: "steer" | "followUp" }>;
	abort(): Promise<void>;
	history(before?: MessageId, limit?: number): Promise<{ messages: ChatMessageView[]; hasMore: boolean }>;
	applyDotChange(next: Dot): Promise<void>;       // §7
	runLinkTurn(req: LinkTurnRequest): Promise<string>; // spec 07 §4 (separate session)
	clear(): Promise<void>;
	dispose(): Promise<void>;
}

export interface DotHostDeps {
	paths: Paths; store: Store; models: ModelService; connections: ConnectionService;
	policy: PolicyEngine; approvals: ApprovalBroker; pii: PiiService; linkBus: LinkBus;
	emit: (e: ChatEvent) => void; log: Logger;
}
```

### 3.1 Concurrency
- One run at a time per DotHost (pi enforces this, and we track `isStreaming`).
- If the current run was triggered by an events message (spec 12 §2.3) and the user sends with mode `auto` → `steer` (the user preempts background work).
- `send` with mode `auto`: if idle → `session.prompt(text)` (do **not** await completion inside IPC;
  start it, attach `.catch` → emit `error`, and return immediately); if streaming → `followUp`.
- Global limit `settings.runtime.maxConcurrentRuns` (default 4) via a semaphore in DotRuntime.
  Over the limit, the message is queued, the status shows "waiting…", and it starts FIFO when a slot frees.

## 4. Creating the pi session (`ensureSession`)

```ts
const cwd = dot.workspaceDir;                 // mkdir -p on first use
const agentDir = paths.piDir;
const settingsManager = SettingsManager.inMemory({
	compaction: { enabled: true },
	retry: { enabled: true, maxRetries: 2 },
});
const resourceLoader = new DefaultResourceLoader({
	cwd, agentDir, settingsManager,
	noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
	// noExtensions only skips *discovered* extension paths; inline extensionFactories still load
	// (verified in pi 1.0.2 resource-loader.ts). T14 keeps a test asserting our inline tools are registered.
	noExtensions: true,
	systemPrompt: compileSystemPrompt(dot, ctx),   // spec 08 §3 — REPLACES pi's coding prompt
	extensionFactories: [
		piiExtension(deps, dot),          // FIRST: context redaction must see final messages
		policyExtension(deps, dot),       // tool_call gate (after PII restore — see ordering note)
		nativeToolsExtension(deps, dot),  // mac/google/microsoft tools granted to this Dot
		linksExtension(deps, dot),        // list_dots, message_dot
		createCodemodeExtension({ mode: "on" }),
		createToolSearchExtension(),
		mcpExtension(deps, dot),          // createMcpExtension({ loadConfig: () => grantedServers(dot) , ... })
	],
});
await resourceLoader.reload();

const sessionDir = paths.dotSessions(dot.id); // ~/.opendot/dots/<dotId>/sessions
const sessionManager = SessionManager.continueRecent(cwd, sessionDir); // creates a new one if none

const model = models.resolveModel(dot.model ?? settings.defaultModel); // throws NoModelConfigured
const { session } = await createAgentSession({
	cwd, agentDir, modelRuntime: models.runtime, model, thinkingLevel: dot.thinkingLevel,
	resourceLoader, sessionManager, settingsManager,
	noTools: "builtin", // see §4.1 — never pass `tools`
});
await session.bindExtensions({ mode: "rpc" /* ExtensionMode: "tui"|"rpc"|"json"|"print"; no TUI here */, onError: (e) => log.warn("ext", e) });
this.unsub = session.subscribe((ev) => this.onEvent(ev));
```

**Ordering note:** `tool_call` handlers run in extension order and see earlier mutations. The PII
extension restores tokens in `event.input` *first*, then the policy extension decides on real
values and shows restored args in the approval card. Keep `piiExtension` before `policyExtension`.

### 4.1 Tool selection
pi built-ins (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`) are **off** unless the Dot has a grant for the `mac`
connection with feature `files` (read, write, edit, grep, find, ls) or `shell` (bash).

**Do not pass `tools` to `createAgentSession`.** pi's own SDK example warns that `tools` restricts the session to the named
tools and hides MCP tools. Instead:
```ts
createAgentSession({ …, noTools: "builtin" });            // built-ins off; extension tools (ours, MCP direct) stay on
settingsManager.applyOverrides({ defaultTools: ["+codemode", "+tool_search", ...grantedBuiltins.map((t) => `+${t}`)] });
```
(`settingsManager` is the in-memory one created above; apply the overrides before `createAgentSession`.)
T14 must include a test that asserts the active tool names for three Dots: (a) no grants → `list_dots`, `message_dot`,
`codemode`, `tool_search` and **no** built-ins; (b) the `files` grant → plus the six file tools; (c) the `shell` grant → plus `bash`.
If (a) fails because `noTools: "builtin"` and `defaultTools` interact differently, fix it here and record the working
combination in this section.

### 4.2 Workspace dir
Default `~/.opendot/dots/<dotId>/workspace`. The file tools are
confined to it by pi's cwd. The policy extension also **blocks** `read/write/edit/grep/find/ls` whose
resolved path escapes `workspaceDir` or the Dot's extra granted folders (spec 05 §6.1).

## 5. Event mapping (`event-mapper.ts`)

`onEvent(ev: AgentSessionEvent)` → zero or more `ChatEvent`s. Keep a `current` assistant message id.

| pi event | ChatEvent(s) | Notes |
|---|---|---|
| `agent_start` | `status{thinking}` | |
| `message_start` (role user) | `message-start` (role `user`) | id = the pi message's entry id if available, else `msg_<nanoid>`. Always emitted. It carries `clientNonce` so the renderer replaces its optimistic bubble (see below). |
| `message_start` (role assistant) | `message-start` (assistant, streaming, empty text) + `status{typing}` | |
| `message_update` | `message-delta` (token-level) + periodic `message-update` snapshots | **Handled by `StreamEmitter`, spec 14 §2** (first delta immediately, then ≤ 1 per 16 ms, snapshot every 1 s, PII-safe holdback). |
| `message_end` (assistant) | `message-end` (final, restored, with usage) | Update `dot.lastMessagePreview`, `lastActivityAt`, and `unreadCount` (+1 if the Dot isn't focused) → `dot-updated`. |
| `tool_execution_start` | `tool-start` (running) + `status{tool: label}` | args restored. Nested calls (`parentToolCallId`) are attached to the parent chip as sub-steps. |
| `tool_execution_update` | `tool-update` | partial result preview |
| `tool_execution_end` | `tool-update` (done/error, resultPreview ≤ 2000 chars) | |
| `auto_retry_start` | `status{thinking}` + a system message "Retrying (2/3)…" (not persisted) | |
| `compaction_start/end` | a system message "Summarising older messages…" (transient) | |
| `agent_settled` | `status{idle}` | |
| errors (`agent_end` with an error message / a thrown prompt) | `error{message, retryable}` + `status{error}` | |

Text extraction: an assistant `content` is an array of blocks. `text` = join of `type:"text"` blocks;
`thinking` = join of `type:"thinking"` blocks (skip `redacted`). Tool calls come from tool events, not content.

**Optimistic send:** `chat.send` returns immediately. The renderer appends a local user bubble with
`id = "local_<nonce>"`. The main process emits `message-start` for the user message, and
`clientNonce` is passed along: `DotHost.send(text, mode, nonce)` stores `pendingNonce` and the next
user `message_start` uses it, so the store replaces `local_<nonce>` (`clientNonce` is part of the `message-start` event in spec 02).

## 6. History (`history()`)

Read from `session.sessionManager` (or a read-only `SessionManager.open` when no live session):
walk the **active branch** (`getBranch()`), map message entries to `ChatMessageView` (user/assistant;
tool results are folded into the preceding assistant's `toolCalls` by `toolCallId`). Apply
`pii.restore(dotId, text)` to everything. Page from the end: `limit` default 50, `before` = message id.
Hide internal system/custom entries. Then merge in `LinkExchange`s involving this Dot from `store.exchanges` by time
(as `link-out` when `from === dot.id`, `link-in` when `to === dot.id`; spec 07 §6). Link conversations are never written into the main pi session.

## 7. Applying Dot changes (`applyDotChange`)

| Changed field | Action |
|---|---|
| `model` / `thinkingLevel` | `session.setModel(model)` / `session.setThinkingLevel(level)` (live) |
| `persona`, `name` | rebuild the system prompt: dispose and recreate the session on the next send (history persists in JSONL) |
| `grants`, `piiMode`, `workspaceDir` | mark `needsRecreate = true`; recreate before the next prompt when idle |
| appearance, pinned, muted, archived | no runtime effect |

Recreate = `await session.abort()` if streaming (only when the user confirmed), `dispose()`, then `ensureSession()`.

## 8. DotRuntime (`dot-runtime.ts`)

```ts
export class DotRuntime {
	get(dotId: DotId): DotHost;          // creates host (not session) on demand
	disposeDot(dotId: DotId): Promise<void>;
	disposeAll(): Promise<void>;          // on app quit (before-quit → await, max 3 s)
	acquireRunSlot(): Promise<() => void>; // semaphore
}
```
Idle reaper: every 60 s, dispose the **session** (not the host) of Dots idle for more than
`idleDisposeMinutes` that have no pending approvals or link exchanges. **Always-on Dots and the Super Dot (while it has
an enabled watcher) are exempt** (spec 12 §2.4).

## 9. Failure modes (must be handled and tested)

- No model configured → `error{ message: "Choose a model for this Dot in Settings → Models", retryable:false }`.
- Missing API key / 401 → message names the provider and links to Settings.
- Provider unreachable (Ollama not running) → "Can't reach Ollama at http://localhost:11434. Is it running?"
- MCP server failing → the Dot still works. The connection status shows the error and the Dot's header shows a ⚠ chip.
- App quit mid-run → `disposeAll` aborts the runs. pi has already persisted the finished entries.
