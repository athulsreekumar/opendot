# Spec 12 — Always-on Dots (24/7, realtime)

Goal: a Dot with **Always on** enabled keeps working for as long as OpenDot runs, even with the window closed. It
**watches its data sources**, reacts within seconds of new data arriving, and tells the user only what matters.
Its replies stream into its chat as they are generated (spec 14).

Honest limits (shown in the UI copy and README):
- OpenDot is a local app. When the Mac is **asleep or shut down**, nothing runs. On wake, every watcher runs a catch-up pass immediately.
- Gmail/Graph push notifications need a public webhook endpoint, which a desktop app doesn't have. OpenDot uses **incremental polling
  with change cursors** (Gmail `historyId`, Graph delta links, Drive page tokens). Default 30 s, minimum 15 s, so new data shows up within one interval.
  Truly push-based sources (folders, MCP resource subscriptions, the local webhook) are near-instant.

## 1. Background lifecycle (`src/main/background.ts`, T54)

| Concern | Behaviour |
|---|---|
| Close window (red button / ⌘W) | `settings.background.runInBackground` true → `win.hide()` (`event.preventDefault()` in `close`). False → quit. |
| `window-all-closed` | never quits on macOS |
| ⌘Q / tray "Quit OpenDot" | the confirm dialog "Quit and stop all Dots?" appears only when always-on Dots exist (with a "Don't ask again" checkbox) → `before-quit` → `runtime.disposeAll()` (max 3 s) |
| Menu bar (Tray) | Always shown while running. Template icon: the brand's three dots (16×16 @1x/@2x `build/trayTemplate.png`), with an overlay dot when something needs attention. Menu: status line ("4 Dots running · 2 updates"), "Open OpenDot", a list of up to 8 Dots with unread counts (click → open), "Approvals (N)…", separator, "Pause all Dots" (checkbox → `settings.background.paused`), "Settings…", "Quit OpenDot". Rebuilt on health changes (throttled 1 s). |
| Dock | `hideDockWhenClosed` → `app.dock.hide()` on hide, `app.dock.show()` on show. |
| Launch at login | `app.setLoginItemSettings({ openAtLogin: true })`. At startup, if `app.getLoginItemSettings().wasOpenedAtLogin` or `process.argv.includes("--hidden")` → don't show the window. |
| Sleep / wake | `powerMonitor.on("suspend")` → pause the scheduler. `on("resume")` → after 5 s, catch-up: every enabled watcher gets `nextRunAt = now + jitter(0..10 s)`. |
| Lock screen | keep running (no change). |
| Network | Every failed poll with a network error (`ENOTFOUND`, `ECONNRESET`, `fetch failed`) → that watcher backs off. A global `NetworkMonitor` checks `net.isOnline()` every 15 s; offline → the scheduler pauses network sources. Back online → catch-up as on resume. |
| App Nap | macOS may coalesce timers of a hidden app. If `keepAwake` is true and ≥ 1 always-on Dot is enabled → `powerSaveBlocker.start("prevent-app-suspension")`, stopped otherwise. The default is false; the Settings copy explains the battery trade-off. |
| Crash safety | `process.on("uncaughtException")` / `unhandledRejection` → log + keep running (never exit for a Dot error). The renderer crashing (`render-process-gone`) → reload the window. Main itself is never restarted by itself. |

## 2. Components

```
WatcherService ──(DotEvent)──▶ EventRouter ──(batch)──▶ DotSupervisor ──▶ DotHost.deliverEvents()
   │ sources (§4)                 │ dedupe, quiet hours,       │ keeps sessions warm,       │ pi sendCustomMessage
   │ scheduler, cursors           │ batching, budgets          │ restarts, health           │ → streamed reply → UI
```

### 2.1 WatcherService (`src/main/watchers/watcher-service.ts`, T57)
```ts
export interface WatcherSource<C = Record<string, unknown>> {
	type: WatcherType;
	label: string;                      // "Gmail inbox"
	requires?: { connectionType?: ConnectionType; feature?: string };
	configSchema: z.ZodType<C>;
	defaultIntervalSec: number;         // polling sources
	minIntervalSec: number;
	/** Polling sources: fetch new items since `cursor`. First run (cursor undefined): set the cursor to "now" and return NO events (no backfill). */
	poll?(ctx: SourceCtx<C>, cursor: string | undefined): Promise<{ events: NewEvent[]; cursor: string | undefined }>;
	/** Push sources: start listening; call ctx.emit(); return a stop function. */
	start?(ctx: SourceCtx<C>): Promise<() => Promise<void>>;
	/** For the "Test" button: validate config + credentials and return up to 3 recent sample items WITHOUT advancing the cursor. */
	test(ctx: SourceCtx<C>): Promise<{ ok: boolean; message: string; sample: NewEvent[] }>;
}
export type NewEvent = Omit<DotEvent, "id" | "dotId" | "watcherId" | "type" | "receivedAt" | "status">;
export interface SourceCtx<C> { watcher: Watcher; config: C; dot: Dot; deps: { connections; oauth; secrets; log; fetch: typeof fetch }; emit(e: NewEvent): void; signal: AbortSignal }
```
Scheduler: one `setInterval(tick, 1000)`. Each tick runs every watcher with `nextRunAt <= now`, `enabled`, not running, Dot `alwaysOn.enabled`,
not globally paused. **Max 4 polls in flight** app-wide (a queue). After a run: `nextRunAt = now + intervalSec * (1 ± 0.1 jitter)`.
On error: `state = "backoff"`, delay = `min(intervalSec * 2^failures, 30 min)`. Auth errors (401 after a refresh) → `state = "needs-auth"`, no retry
until the user reconnects (`connections` emits a change → reset). Persist the cursor + state after every run (`watchers.json`, debounced 1 s).
Dedupe: `data/dedupe/<watcherId>.json` ring of 5000 `dedupeKey`s, checked before emitting.

### 2.2 EventRouter (`src/main/watchers/event-router.ts`, T58)
- Receives `DotEvent` (status `queued`), appends it to `data/events/<dotId>.jsonl`, emits `events-received` to the UI immediately (the user sees
  the event card before the Dot even starts thinking: realtime feedback).
- **Batching:** per Dot, open a batch on the first event and deliver after `batchWindowSec` (default 10 s). `importanceHint: "high"` → deliver
  immediately (closing the batch). Max 25 events per batch (overflow → the next batch).
- **Budget:** before delivering, check `usage`: turns in the last hour < `maxTurnsPerHour`, today's cost < `maxCostUsdPerDay` (skipped for local
  models), global cost < `settings.background.maxCostUsdPerDay`. Over budget → mark events `dropped-budget`? **No:** keep them queued, set
  the health `over-budget`, and show a system notice "Inbox paused until 15:00 (hourly limit). 12 events waiting." When the budget frees up, deliver ONE
  batch with a summary header "You were paused; here are the N events since 14:02" (oldest 25 in full, the rest as title lines).
- Usage accounting: on every assistant `message_end`, add `usage.cost.total` (pi reports it) and +1 turn for event-triggered turns
  (`data/usage.json`, hourly buckets kept 48 h, daily buckets kept 90 days).

### 2.3 Delivery into the Dot (`DotHost.deliverEvents(batch)`, T58)
Events go into the Dot's **main session**, so the Dot has continuity ("the invoice I mentioned this morning…") and the user can reply directly:
```ts
const content = renderEventsForModel(batch); // §3
void session.sendCustomMessage(
	{ customType: "opendot.events", content, display: true, details: { eventIds: batch.map((e) => e.id) } },
	{ triggerTurn: true, deliverAs: "followUp" },
).catch((e) => this.fail(e));   // NEVER await: when idle this resolves only after the whole turn
```
- If the Dot is streaming a **user** turn, `deliverAs: "followUp"` queues the batch until that turn finishes.
- If the user sends a message while an **event** turn is running, `DotHost.send` uses `steer` (the user always gets attention fast). The UI hint
  in that state: "Inbox is handling 3 new events. Your message will interrupt."
- The custom message is converted for the model by pi (custom → user-role content). The PII `context` hook must also map `role: "custom"`
  messages (spec 06 §5.5 `mapTextDeep`).
- Event-mapper: a `message_start/end` for a custom message with `customType === "opendot.events"` → a ChatMessageView with role `event` and
  `events` = the views (status `delivered`); history() maps the persisted custom entries the same way.

### 2.4 DotSupervisor (`src/main/runtime/dot-supervisor.ts`, T59)
- On startup (after services) and on every `alwaysOn` toggle: for each always-on Dot → `DotHost.ensureSession()` (warm), start its watchers.
- Always-on Dots are **exempt from the idle reaper** (spec 03 §8).
- Failure handling: if `ensureSession` or a delivery throws (provider down, model removed), → `state: "backoff"`, retry after 5 s, 30 s, 2 min, 10 min,
  then every 30 min; increment `restarts`. Queued events stay queued. An error that needs the user (no model / bad key) → `state: "error"` + one
  notification ("Inbox stopped: the API key was rejected") and no retry until the config changes.
- Health: computes `DotHealth` for every Dot, emits `runtime:health` on change (throttled 1/s per Dot). Feeds the tray and the Activity screen.

## 3. What the Dot sees and how it answers

`renderEventsForModel(batch)`:
```
[OpenDot · 3 new events · 2026-10-04 14:32 Europe/London]
1. Gmail · from Priya Nair <⟦EMAIL_1⟧ after PII> · "Invoice #2041 overdue" · 14:31
   Hi, just a reminder that invoice #2041 for September is now 14 days overdue…
2. Calendar · "Design review" starts in 15 min · 14:45–15:30 · Meet link
3. Folder ~/Invoices · new file "acme-oct.pdf" (82 KB)
```
(body text per event ≤ 1500 chars in the batch; the full body is available through the event's tool, e.g. `gmail_read(id)` in facts.)

Prompt section `always_on` for always-on Dots (set per turn via `systemPromptOptions.sections`, spec 08 §3):
```
## Always-on mode
You run continuously and receive [OpenDot · … events] messages when your data sources change: {dataSources}.
Standing instructions from the user: {standingInstructions or "Tell me about anything that likely needs my attention."}
For each events message, decide what the user needs to know:
- Start your reply with exactly one tag: [URGENT] for things needing attention within the hour, [UPDATE] for useful news,
  or reply with exactly NO_UPDATE (nothing else) when nothing is worth telling.
- After the tag, be brief: one line per item that matters, most important first. Use tools if you need details or to act;
  actions that change things still need approval.
```
Reply handling (event-mapper, streaming-safe, spec 14 §3):
- Hold back up to the first 12 characters of a reply to an events message until the tag is known (normally 1–3 tokens).
- `NO_UPDATE` → the assistant message is hidden from the timeline (kept in the transcript), the event card collapses to "Handled quietly ·
  3 events", and events go to `handled`. No unread increment, no notification.
- `[UPDATE]` / `[URGENT]` → the tag is stripped from the display, `importance` is set, and the message streams normally. Unread +1.
  Notification per `alwaysOn.notify` and quiet hours: urgent → always (sound), update → when `notify === "updates"` and not in quiet hours.
- No tag (the model ignored the format) → treat as `[UPDATE]`.
- Approvals requested during an event turn (window hidden) → a native notification "Inbox needs your approval" (click → open). The approval
  expiry for event turns is 30 min (5 min for user turns).

## 4. Sources (T60–T63)

| Type | Kind | Requires | Config (zod) | Default / min interval | How "new" is detected | Event |
|---|---|---|---|---|---|---|
| `schedule` | timer | — | `{ mode: "every"|"daily"|"weekly"; everyMin?: number(5–1440); times?: string[] ("HH:mm"); days?: number[]; timeZone }` | n/a | next fire time computed; missed fires during sleep → one catch-up fire on wake if < 6 h late | title "Scheduled: Morning briefing", body = the watcher label |
| `folder` | push | mac `files` grant covering the path | `{ path: string; recursive: boolean; include?: string[] (globs ext like "*.pdf"); events: ("created"|"modified"|"deleted")[] }` | n/a | `fs.watch(path, { recursive })`, debounce 2 s per path, ignore dotfiles, temp files (`~$*`, `*.crdownload`, `*.part`); stat to classify | "New file acme-oct.pdf in Invoices" with path, size |
| `url` | poll | — | `{ url: https; selector?: never (v1); ignorePatterns?: string[] }` | 300 / 60 | GET, strip tags/scripts/whitespace → sha256. Change → the event body = changed lines (simple line diff, ≤ 1500 chars) | "Page changed: <title>" |
| `rss` | poll | — | `{ url }` | 300 / 60 | parse `<item>`/`<entry>` via a small regex parser (`src/main/watchers/sources/rss-parse.ts`, tested with RSS 2.0 + Atom fixtures); cursor = JSON array of the last 200 guids/links | one event per new item: title, link, summary |
| `local-webhook` | push | `settings.localWebhook.enabled` | `{ }` (the token is generated and stored in SecretStore `webhook:<watcherId>`) | n/a | HTTP server on `127.0.0.1:<port>` (one server for all), `POST /hooks/<watcherId>` with `Authorization: Bearer <token>`, JSON or text body ≤ 64 KB → event. 401 on a bad token, 413 too large, 429 at > 60 req/min | title from `body.title` or the first line; body = the pretty JSON/text |
| `gmail` | poll | google `gmail` | `{ query?: string (Gmail search, e.g. "is:important -category:promotions"), labelIds?: string[] (default ["INBOX"]) }` | 30 / 15 | first run: `users.getProfile` → historyId cursor. Then `users.history.list?startHistoryId=&historyTypes=messageAdded&labelId=INBOX`; 404 (history too old) → reset the cursor to the current profile historyId and emit nothing. For new message ids: `messages.get(format=metadata, From/Subject/Date)` + snippet; if `query` set, check membership with `messages.list?q=<query> rfc822msgid:` (or skip the filter if that fails, and say so in the test result) | "From X · Subject"; facts: from, subject, messageId (so the Dot can `gmail_read`); dedupe = message id |
| `google-calendar` | poll | google `calendar` | `{ calendarId: "primary"; remindMinutes: number[] (default [15]) }` | 60 / 30 | `events.list?syncToken=` (first run: full list for the next 7 days to get a nextSyncToken, no events). Changes → "Event added/changed/cancelled". Reminders: keep the next 24 h of events in the cursor JSON; emit "Starts in 15 min" once per (eventId, minutes) | |
| `google-drive` | poll | google `drive` | `{ folderId?: string }` | 120 / 60 | `changes.getStartPageToken` then `changes.list?pageToken=` | "Doc updated: Q4 plan (by Sam)" |
| `outlook-mail` | poll | microsoft `mail` | `{ folder: "inbox" }` | 30 / 15 | `GET /me/mailFolders/inbox/messages/delta?$select=subject,from,receivedDateTime,bodyPreview` → follow `@odata.nextLink`, store `@odata.deltaLink` as the cursor (first run: drain the pages, emit nothing) | like gmail |
| `outlook-calendar` | poll | microsoft `calendar` | `{ remindMinutes: number[] }` | 60 / 30 | `GET /me/calendarView/delta?startDateTime=now&endDateTime=now+7d` with deltaLink | like google-calendar |
| `onedrive` | poll | microsoft `onedrive` | `{ path?: string }` | 120 / 60 | `GET /me/drive/root/delta` deltaLink | |
| `teams-chat` | poll | microsoft `teams` | `{ chatIds: string[] (picked in the UI from teams_list_chats) }` | 30 / 15 | per chat `GET /me/chats/{id}/messages?$top=20&$orderby=createdDateTime desc`, cursor = JSON {chatId: lastCreatedDateTime} | "Sam in Design chat: …" |
| `mcp-resource` | push (fallback poll 60) | an installed MCP connection | `{ connectionId; uri }` | n/a / 60 | own `McpClient` connection (spec 05 §3.4 transport code). If the server's `initialize` result has `capabilities.resources.subscribe` → `client.request("resources/subscribe", { uri })` + `client.onNotification("notifications/resources/updated", …)` → `readResource(uri)` → hash; else poll `readResource` every interval | "Resource updated: <uri>" with the first 1500 chars |
| `mcp-poll` | poll | an installed MCP connection | `{ connectionId; tool: string; args: string (JSON) }`; the tool must be `readOnlyHint: true`, or the user ticks "I confirm this tool only reads data" | 120 / 30 | `callTool` → sha256 of the text content; a change → event with a line diff | "<server> · <tool> result changed" |
| `mac-calendar` | poll | mac `calendar` | `{ remindMinutes: number[] }` | 120 / 60 | JXA list of events in the next 24 h (spec 05 §6), reminders as above | |
| `mac-reminders` | poll | mac `reminders` | `{ list?: string }` | 120 / 60 | JXA: reminders due ≤ now and not completed; dedupe per (id, dueDate) | "Reminder due: Pay rent" |

Every source: all HTTP via the native connector clients (spec 05 §5, which refresh tokens), errors mapped to `lastError` in plain language, and
a unit test per source with recorded fixtures (`test/fixtures/sources/<type>/*.json`): first run sets the cursor and emits nothing; second run emits exactly the new items; dedupe; error → backoff.

## 5. UI (T64)

- **Dot Info → "Always on" section** (above Tools): the master Switch "Always on — keep working in the background", status (running · next check in 12 s · 3 events today ·
  $0.14 today), standing instructions TextArea, Notify me (SegmentedControl: Urgent only · Updates · Never), quiet hours (reuses the schedule editor from Dot Links),
  batch window Select (Instant · 10 s · 1 min · 5 min), budget (turns/hour slider 1–120, $/day input).
  **Watchers list**: rows (icon, label, "every 30 s" / "instant", state pill, last event time, ⋯ Run now / Edit / Delete) + "Add watcher" → a Dialog with a type
  picker (only types whose requirements are met; others shown disabled with "Connect Gmail first"), a per-type form generated from a small field map, "Test"
  (shows sample items), Save.
- **Event cards in chat** (role `event`): compact, centred-left, bg sunken, radius lg, 1 line per event (source icon · title · time), "+N more" expander,
  and a footer status: "Inbox is reading…" (spinner) → "Handled quietly" or nothing (when a visible reply follows directly).
- **Dot list**: always-on Dots show a small pulsing ring on the avatar (status `online`) while running; `backoff`/`error` shows a warning dot. The preview
  line shows the latest update text (tag stripped), prefixed with ⚠ for urgent.
- **Activity screen** (`#/activity`, a new rail item with a Radar icon between Dot Links and Connections): a table of all Dots' health (state, watchers, queued, turns/h,
  cost today, last error) + a global events feed (filter by Dot/source) + "Pause all". Each row → open the Dot.
- **Settings → Background** (new section `background`): run in background, launch at login, hide the dock icon when closed, keep the Mac awake (with an explanation),
  global $/day cap, local webhook enable + port (+ copy-paste curl example).
- **Onboarding**: one extra step after "Pick your first Dots": "Keep your Dots running in the background?" (launch at login + run in background, both default on).

## 6. Defaults by template (spec 08 §4 templates get `alwaysOn` + `suggestedWatchers`)

| Template | Always on | Suggested watchers | Standing instructions |
|---|---|---|---|
| inbox | on | gmail (INBOX, 30 s) / outlook-mail | "Tell me about emails from real people that need a reply or a decision. Ignore newsletters and receipts unless they're unusual." |
| calendar | on | google-calendar / outlook-calendar / mac-calendar (remind 15) | "Warn me about conflicts and remind me 15 minutes before meetings, with the agenda if there is one." |
| files | on | folder (~/Downloads, created) | "Tell me when important documents arrive and suggest where to file them." |
| research | off | rss (user adds) | "Summarise new posts in one line each; flag anything about my projects." |
| finance | off | folder (~/Invoices) | "Flag new invoices and anything overdue." |
| wellbeing | on | schedule (daily 09:00, 18:00) | "Check in briefly; no lectures." |
| others | off | — | — |
