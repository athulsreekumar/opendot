# Spec 05 — Connections: MCP (unlimited), Google, Microsoft, macOS

A **Connection** is installed once, app-wide. A **Grant** gives a Dot access to it (`Dot.grants`).
Tool permissions per Dot are in spec 06 §3.

## 1. ConnectionService (`src/main/connections/connection-service.ts`)

```ts
export class ConnectionService {
	constructor(deps: { store: Store; secrets: SecretStore; oauth: OAuthManager; log: Logger; emit: Emitter });
	catalog(): CatalogEntry[];
	list(): Connection[];
	install(input: InstallConnectionInput): Promise<Connection>;
	importJson(json: string): Promise<{ added: Connection[]; errors: string[] }>;
	update(id: ConnectionId, patch: ConnectionPatch): Promise<Connection>;
	remove(id: ConnectionId): Promise<void>;   // also removes grants from all Dots + secrets `conn:<id>:*`
	check(id: ConnectionId): Promise<ConnectionStatus>;
	statusOf(id: ConnectionId): ConnectionStatus | undefined;
	reportStatus(s: ConnectionStatus): void;   // called by per-Dot MCP extensions; merges + emits "connection:status"
	/** Resolve a Dot's grants into what the runtime needs. Secrets are resolved here, in main only. */
	resolveForDot(dot: Dot): Promise<{
		mcpServers: Array<{ name: string; config: McpServerConfig }>;   // pi mcp.json entry shape
		nativeToolSets: Array<{ connection: Connection; features: string[] }>; // google / microsoft / mac
	}>;
	onChange(fn: (ids: ConnectionId[]) => void): () => void;  // DotHosts mark needsRecreate
}
```

Rules:
- `name` must match `/^[A-Za-z0-9_-]{1,40}$/`, be unique case-insensitively, and be unique after `-`→`_`
  (pi treats `a-b` and `a_b` as the same server).
- Secret values are stored as `conn:<id>:<KEY>` in SecretStore. In configs they appear as `${secret:KEY}` and
  are replaced in `resolveForDot` (never written to disk, never sent to the renderer).
- A **disabled** connection is excluded from every Dot. A removed one is also deleted from grants.
- Default exposure on install: `direct` if the server has ≤ 15 tools at first `check()`, else `deferred`.

## 2. MCP connections

### 2.1 Config mapping → pi `McpServerConfig`
```ts
// stdio
{ command, args, env: resolvedEnv, cwd, exposure, toolExposure, description, timeout: 60 }
// http (streamable HTTP; SSE is NOT supported by pi — reject URLs ending in /sse with a helpful message)
{ url, headers: resolvedHeaders, oauth, exposure, toolExposure, description, timeout: 60 }
```

### 2.2 Import from other clients (`importJson`)
Accept any of:
- `{ "mcpServers": { name: {...} } }` (Claude Desktop, Claude Code, Cursor)
- `{ "servers": { name: {...} } }` (VS Code). Replace `${input:x}` with an empty value and report "needs value for x".
- A single server object `{ "command": ..., "args": [...] }` (asks for a name in the UI).
`env` and `headers` values that look secret (key name matches `/(KEY|TOKEN|SECRET|PASSWORD|AUTH)/i` or
value matches `/^(sk-|ghp_|xox|AIza|Bearer )/`) are moved to SecretStore automatically.

### 2.3 Catalog (`src/main/connections/catalog/*.json`, T23)

One JSON file per entry, validated by `CatalogEntry` (spec 02). **`verified` must be set by running
`node scripts/verify-catalog.mjs`** (T23 writes it). That script, for stdio entries, spawns the
command, sends `initialize` + `tools/list` and expects a result within 30 s. For http entries it POSTs
`initialize` and treats HTTP 200 or 401 (auth required) as reachable. Unverified entries stay in the
repo with `verified: false` and are hidden unless "Show unverified" is on.

Initial entries (candidates; verification decides):

| id | type | config | inputs | exposure |
|---|---|---|---|---|
| `filesystem` | stdio | `npx -y @modelcontextprotocol/server-filesystem {FOLDER}` | FOLDER (arg, folder picker) | direct |
| `memory` | stdio | `npx -y @modelcontextprotocol/server-memory` | — | direct |
| `sequential-thinking` | stdio | `npx -y @modelcontextprotocol/server-sequential-thinking` | — | direct |
| `everything` | stdio | `npx -y @modelcontextprotocol/server-everything` | — (test server, category other) | deferred |
| `fetch` | stdio | `uvx mcp-server-fetch` (requiresUv) | — | direct |
| `git` | stdio | `uvx mcp-server-git --repository {REPO}` | REPO (arg) | deferred |
| `time` | stdio | `uvx mcp-server-time` | — | direct |
| `playwright` | stdio | `npx -y @playwright/mcp@latest` | — | deferred |
| `context7` | http | `https://mcp.context7.com/mcp` | — | direct |
| `github` | http | `https://api.githubcopilot.com/mcp/` header `Authorization: Bearer ${secret:GITHUB_TOKEN}` | GITHUB_TOKEN (secret, header) | deferred |
| `notion` | http | `https://mcp.notion.com/mcp` (OAuth) | — | deferred |
| `linear` | http | `https://mcp.linear.app/mcp` (OAuth) | — | deferred |
| `sentry` | http | `https://mcp.sentry.dev/mcp` (OAuth) | — | deferred |
| `figma` | http | `https://mcp.figma.com/mcp` (OAuth, `oauth.clientName` may be required, see pi mcp.md) | — | deferred |
| `supabase` | http | `https://mcp.supabase.com/mcp` (OAuth) | — | deferred |
| `vercel` | http | `https://mcp.vercel.com` (OAuth) | — | deferred |
| `stripe` | http | `https://mcp.stripe.com` (OAuth) | — | deferred |
| `huggingface` | http | `https://huggingface.co/mcp` header `Authorization: Bearer ${secret:HF_TOKEN}` | HF_TOKEN | deferred |

Plus fixed non-MCP entries: `google` (type google), `microsoft` (type microsoft) and `mac` (type mac),
always `verified: true`.

### 2.4 Unlimited
There is no cap on connections. Performance guidance shown in the UI when a Dot has more than 8 MCP grants:
"Large tool sets are loaded on demand (tool search)". Implement by forcing `deferred` for servers above 8.

### 2.5 Node / uv availability
`nodeAvailable()`: run `which node npx uvx` (after `fix-path`). When `npx` is missing, catalog cards with
`requiresNode` show "Requires Node.js — Install" (opens https://nodejs.org/en/download). The same goes for uv
(https://docs.astral.sh/uv/getting-started/installation/).

## 3. MCP inside a Dot (T22)

### 3.1 The extension
```ts
export function mcpExtension(deps: DotHostDeps, dot: Dot, servers: Array<{ name: string; config: McpServerConfig }>) {
	return createMcpExtension({
		loadConfig: () => ({
			servers: servers.map((s) => ({ name: s.name, config: s.config, source: "opendot", scope: "global" })),
			autoEnableCodemode: true,
			errors: [],
		}),
		logPath: join(deps.paths.piDir, "mcp.log"),
		openUrl: (url) => shell.openExternal(url),
		updateConfig: () => {}, // OpenDot owns config; ignore /mcp edits
	});
}
```
`servers` comes from `connections.resolveForDot(dot)` (awaited in `ensureSession` before building extensions).

### 3.2 OAuth for MCP HTTP servers
pi handles discovery, dynamic registration, PKCE and refresh. Tokens are stored in
`<piDir>/mcp-auth.json` (mode 0600) because `PI_CODING_AGENT_DIR` points at `piDir` (spec 03 §2).
`connections.signIn(id)` for an MCP http connection: create a throwaway in-memory pi session with only that
server and run `/mcp login <name>` via `session.prompt("/mcp login <name>")`. pi opens the browser through
`openUrl`. Resolve once the status becomes `connected`. Time out after 5 min.
> Known limitation (documented in the README): MCP OAuth tokens live in pi's file store, not in Keychain. Encrypt in v1.1.

### 3.3 Status reporting inside a Dot
A tiny companion inline extension (`mcpStatusExtension`) listens to `session_start` and `turn_end`, then calls
`pi.getAllTools()` and counts tools whose name starts with `mcp__<serverName>__` (pi replaces non-`[A-Za-z0-9_]`
characters with `_`). A count > 0 → `connected`. It reports through `connections.reportStatus`.
**Do NOT subscribe to `mcp_servers_change`:** per pi's types, handling that event marks your extension as the one that
connects registered servers, which would disable pi's built-in MCP connection. Detailed errors (stderr, auth) come from `check()` (§3.4).

### 3.4 `check(id)` — test a connection without a Dot
Use pi's standalone MCP client, `@earendil-works/pi-mcp` (add it as an exact dependency at the same version as pi,
re-exported via `pi-adapter.ts`):
```ts
import { McpClient, StdioTransport, StreamableHttpTransport } from "@earendil-works/pi-mcp";
const transport = conn.type === "mcp-stdio"
	? new StdioTransport({ command, args, env: { ...process.env, ...resolvedEnv }, cwd })
	: new StreamableHttpTransport({ url, headers: resolvedHeaders });
const client = new McpClient({ name: "OpenDot", version: app.getVersion() });
await client.connect(transport);          // 20 s timeout via Promise.race
const tools = await client.listTools();   // → ConnectionStatus.tools (annotations → readOnly/destructive)
await client.close();
```
Map errors: spawn ENOENT → "Command not found: npx (install Node.js)"; HTTP 401/403 without a token →
`needs-auth`; anything else → `error` with the message and the last 2 KB of stderr (read `StdioTransport` options for
a stderr hook; if there is none, spawn with `stderr: "pipe"` per its options type).

### 3.5 Echo MCP fixture (`test/fixtures/mcp-echo-server.mjs`, verbatim)

```js
#!/usr/bin/env node
// Minimal MCP stdio server: newline-delimited JSON-RPC 2.0. Tools: echo, delete_everything (destructive, for approval tests).
import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const tools = [
	{ name: "echo", description: "Echo text back", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }, annotations: { readOnlyHint: true } },
	{ name: "delete_everything", description: "Pretend to delete everything", inputSchema: { type: "object", properties: {} }, annotations: { destructiveHint: true } },
];
rl.on("line", (line) => {
	let req; try { req = JSON.parse(line); } catch { return; }
	if (req.id === undefined) return; // notification
	switch (req.method) {
		case "initialize":
			return send({ jsonrpc: "2.0", id: req.id, result: { protocolVersion: req.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "echo", version: "1.0.0" } } });
		case "tools/list":
			return send({ jsonrpc: "2.0", id: req.id, result: { tools } });
		case "tools/call": {
			const { name, arguments: args } = req.params;
			const text = name === "echo" ? String(args?.text ?? "") : "deleted nothing (fixture)";
			return send({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text }] } });
		}
		case "ping":
			return send({ jsonrpc: "2.0", id: req.id, result: {} });
		default:
			return send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found" } });
	}
});
```
Use `process.execPath` as the command with `ELECTRON_RUN_AS_NODE=1` in env when running inside Electron, and
`node` in unit tests.

## 4. OAuth for native connectors (T30) — loopback + PKCE

```ts
export interface OAuthProviderConfig {
	id: "google" | "microsoft";
	authorizeUrl: string; tokenUrl: string;
	clientId: string; clientSecret?: string; // Google desktop clients have a (non-confidential) secret
	scopes: string[]; extraAuthParams?: Record<string, string>;
}
export class OAuthManager {
	signIn(connId: ConnectionId, cfg: OAuthProviderConfig): Promise<{ account?: string }>;
	getAccessToken(connId: ConnectionId, cfg: OAuthProviderConfig): Promise<string>; // refreshes when < 120 s left
	signOut(connId: ConnectionId): Promise<void>;
}
```
Flow: start an `http.createServer` on `127.0.0.1:0` → redirect URI `http://127.0.0.1:<port>/callback` → PKCE S256
(verifier: 64 random bytes base64url) → random `state` → `shell.openExternal(authorizeUrl?...)` → callback
validates `state`, exchanges the code (form-encoded POST), stores `{ access_token, refresh_token, expires_at, scope }`
in SecretStore `oauth:<connId>` → responds with a small "You can close this tab ✓" HTML → closes the server.
Timeout 5 min. Only one sign-in at a time per connection.

## 5. Native stacks

All native tools are pi `ToolDefinition`s built with `defineTool` + TypeBox, registered by
`nativeToolsExtension` only for granted connections and features. Every tool sets `annotations`
(`readOnlyHint` / `destructiveHint` / `openWorldHint: true`) so the PolicyEngine defaults work.
Results are text (concise, ≤ 8 KB; summarise lists as "1. subject — from — date — id") plus `details` for the UI.
HTTP: `fetch` with `Authorization: Bearer <token>`; on 401 refresh once and retry; 429 → respect `Retry-After` once.

### 5.1 Google Workspace (`connections/google/*`)

Endpoints: authorize `https://accounts.google.com/o/oauth2/v2/auth`, token `https://oauth2.googleapis.com/token`.
Auth params: `access_type=offline`, `prompt=consent`, `include_granted_scopes=true`.

| Feature | Scopes | Tools (name → API) | Annotation |
|---|---|---|---|
| base | `openid email` | — (account email from `https://openidconnect.googleapis.com/v1/userinfo`) | |
| gmail | `https://www.googleapis.com/auth/gmail.readonly`, `.../gmail.compose` | `gmail_search(query, max=10)` → `GET gmail/v1/users/me/messages?q=` + metadata fetch; `gmail_read(id)` → `messages/{id}?format=full` (decode the text/plain part, fall back to stripped HTML); `gmail_create_draft(to, subject, body, cc?, threadId?)` → `drafts.create` (RFC 2822, base64url); `gmail_send_draft(draftId)` → `drafts.send` | read: readOnly; draft: not destructive; send: **destructive** |
| calendar | `https://www.googleapis.com/auth/calendar.events` | `calendar_list_events(from, to, calendarId="primary")`; `calendar_create_event(summary, start, end, attendees?, location?, description?)`; `calendar_update_event(id, …)`; `calendar_delete_event(id)`; `calendar_free_busy(from, to)` | list/freebusy readOnly; delete destructive |
| drive | `https://www.googleapis.com/auth/drive.readonly`, `.../drive.file` | `drive_search(query)` → `files?q=fullText contains '…'`; `drive_read(fileId)` → Docs export `text/plain`, Sheets export `text/csv`, others `alt=media` if text ≤ 1 MB; `drive_create_text_file(name, content, folderId?)` | read readOnly; create not destructive |

Base URLs: `https://gmail.googleapis.com/gmail/v1`, `https://www.googleapis.com/calendar/v3`, `https://www.googleapis.com/drive/v3`.
Times: accept ISO 8601. Default timezone = system. Scopes are requested **only for enabled features** (re-consent when a feature is added).

### 5.2 Microsoft 365 (`connections/microsoft/*`)

Authorize `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`, token `.../token`. Public client
(no secret) + PKCE. Always add `offline_access User.Read`. Base `https://graph.microsoft.com/v1.0`.

| Feature | Scopes | Tools | Annotation |
|---|---|---|---|
| mail | `Mail.ReadWrite Mail.Send` | `outlook_search(query, top=10)` → `GET /me/messages?$search="…"&$top=` (header `ConsistencyLevel: eventual`); `outlook_read(id)`; `outlook_create_draft(to, subject, body)` → `POST /me/messages`; `outlook_send_draft(id)` → `POST /me/messages/{id}/send` | send destructive |
| calendar | `Calendars.ReadWrite` | `outlook_list_events(from, to)` → `/me/calendarView?startDateTime=&endDateTime=`; `outlook_create_event`; `outlook_update_event`; `outlook_delete_event` | delete destructive |
| onedrive | `Files.ReadWrite` | `onedrive_search(q)` → `/me/drive/root/search(q='…')`; `onedrive_read(itemId)` → `/content` (text ≤ 1 MB); `onedrive_create_text_file(path, content)` → `PUT /me/drive/root:/{path}:/content` | |
| teams | `Chat.ReadWrite` (work/school accounts only) | `teams_list_chats()`; `teams_read_chat(chatId, top=20)`; `teams_send_chat_message(chatId, text)` | send destructive |

Account email from `GET /me` → `mail ?? userPrincipalName`.

### 5.3 Bring-your-own client ID (setup copy for T33)

**Google:** 1) Open https://console.cloud.google.com/ → create a project. 2) "APIs & Services → Library": enable
Gmail API, Google Calendar API, Google Drive API. 3) "OAuth consent screen": External, add yourself as a test user.
4) "Credentials → Create credentials → OAuth client ID → Desktop app". 5) Copy the Client ID and Client secret into OpenDot.

**Microsoft:** 1) Open https://entra.microsoft.com → App registrations → New registration. 2) Supported accounts:
"Accounts in any organizational directory and personal Microsoft accounts". 3) Redirect URI: platform
"Public client/native (mobile & desktop)", value `http://localhost`. 4) Authentication → "Allow public client flows" = Yes.
5) Copy the Application (client) ID into OpenDot.

(Microsoft allows any loopback port for `http://localhost`. OpenDot uses `127.0.0.1:<port>`. If Entra rejects that,
use the `http://localhost:<port>/callback` form. T32 must verify this against a real tenant or document the fallback.)

## 6. macOS capabilities (`connections/mac/*`, T27)

One `mac` connection with `features` = enabled capabilities. Tools per capability:

| Capability | Tools | Mechanism | Default decision |
|---|---|---|---|
| `files` | pi built-ins `read, write, edit, ls, grep, find`, confined to `workspaceDir` + granted folders | pi + path guard (§6.1) | read-only tools allow; write/edit **ask** |
| `shell` | pi built-in `bash` | pi | **ask** always (UI can set allow per Dot) |
| `calendar` | `mac_calendar_events(from,to)`, `mac_calendar_create(title,start,end,calendar?)` | `osascript -l JavaScript` (JXA, `Application("Calendar")`) | list allow; create ask |
| `reminders` | `mac_reminders_list(list?)`, `mac_reminders_add(title, due?, list?)`, `mac_reminders_complete(id)` | JXA `Application("Reminders")` | add/complete ask |
| `contacts` | `mac_contacts_search(query)` | JXA `Application("Contacts")` | allow |
| `notes` | `mac_notes_search(query)`, `mac_notes_read(id)`, `mac_notes_create(title, body)` | JXA `Application("Notes")` | create ask |
| `screen` | `mac_screenshot(display?)` → returns `image` content | `desktopCapturer.getSources({ types:["screen"], thumbnailSize: 1600 })` | **ask** |
| `clipboard` | `mac_clipboard_read()`, `mac_clipboard_write(text)` | Electron `clipboard` | read ask, write allow |
| `notifications` | `mac_notify(title, body)` | Electron `Notification` | allow |
| `open` | `mac_open_url(url)` (https only), `mac_open_app(name)` | `shell.openExternal`, `open -a` via execFile (no shell) | ask |

Rules: **never** build shell strings. Use `execFile("osascript", ["-l","JavaScript","-e", script], { timeout: 15000 })`
and pass user values with `JSON.stringify` inside the script (no string concatenation of raw input). A JXA error
`-1743` / "Not authorized to send Apple events" → status `denied` and a tool error with an "Open System Settings" hint.

### 6.1 Path guard (files)
Resolve with `fs.realpath` (for a non-existent target, realpath the parent). Allowed if it is inside `dot.workspaceDir`
or any `features` entry of the form `folder:<absPath>` (added via a folder picker in the Dot's Tools section).
Otherwise block: "This Dot can only access: …".

### 6.2 Permission status (`permissions.ts`)
| Capability | Status source |
|---|---|
| screen | `systemPreferences.getMediaAccessStatus("screen")` |
| accessibility | `systemPreferences.isTrustedAccessibilityClient(false)` |
| calendar / reminders / contacts / notes | probe a harmless JXA read (`Application("Calendar").calendars.length`) with a 5 s timeout: ok → granted; -1743 → denied; first run → macOS prompts (not-determined until answered) |
| files, shell, clipboard, notifications, open | `not-required` |

`requestMacPermission(cap)`: run the probe (which triggers the macOS prompt). For screen, call
`desktopCapturer.getSources` once (triggers the prompt), then return the status.

### 6.3 System Settings deep links
```
calendar:      x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars
reminders:     x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders
contacts:      x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts
notes/automation: x-apple.systempreferences:com.apple.preference.security?Privacy_Automation
screen:        x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture
accessibility: x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility
files (full disk, optional): x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles
```
Open them with `shell.openExternal` (allowed scheme for this call only).

### 6.4 Info.plist usage strings (electron-builder `mac.extendInfo`, spec 11 §4)
`NSAppleEventsUsageDescription`, `NSCalendarsUsageDescription`, `NSCalendarsFullAccessUsageDescription`,
`NSRemindersUsageDescription`, `NSRemindersFullAccessUsageDescription`, `NSContactsUsageDescription`,
`NSMicrophoneUsageDescription` (future voice). Each one: "OpenDot lets your Dots <do X> only when you allow it."
