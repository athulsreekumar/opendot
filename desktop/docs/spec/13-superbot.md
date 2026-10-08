# Spec 13 — SuperBot

SuperBot ("Super") is the one Dot you can ask *anything*. It knows what every other Dot does and what data it watches. It routes
your question to the right Dot(s), in parallel, streams their partial answers live, and then streams one synthesised answer with
attributions. It doesn't need tools of its own; its tools are the other Dots.

## 1. The Super Dot

- Created on first run by `DotService.ensureSuperBot()` (idempotent, also run on every startup): `kind: "super"`, name "Super", tagline
  "Ask me anything. I'll check with your Dots.", appearance `{ icon: "sparkles", color: "teal" }` (rendered with the brand mark instead of the icon in the list),
  `alwaysOn.enabled: false` (it can be turned on for briefings, §6), `grants: []`, `roles: ["super"]`, persona from `templates/super.json`.
- It **can't be deleted or archived** (the IPC rejects with `SUPER_IMMUTABLE`). Name, appearance, persona, model and grants are editable.
- It's **always pinned first** in the list (above user-pinned Dots), with a subtle accent-subtle row background.
- Default model: the app default. Recommend (in the Dot Info hint) a strong model, since routing and synthesis quality depend on it.

## 2. Directory (`src/main/superbot/directory.ts`, T65)

For every Dot with `kind === "standard"`, `!archived`, `!hiddenFromSuper`, and where the Dot-Link policy allows `super → dot` (spec 07 with subject `super`), build a card:

```
### Inbox (id dot_x1y2…) — "Your calm email co-pilot"
Does: Reads, searches and drafts Gmail; sends with approval. Summarises threads.
Watches: Gmail inbox (every 30 s) · always on
Knows now: Tracking 3 threads awaiting replies (Acme invoice overdue 14 days; Priya re: contract; Sam's offsite dates). Last update 14:32.
Roles: assistant, comms · Model: local 🔒
```
- `Does` = `dot.profile.capabilities` (built deterministically from grants + persona role first sentence; no LLM).
- `Watches` = `dot.profile.dataSources` from watchers.
- `Knows now` = `dot.profile.knowledgeSummary` (§3).
- Card ≤ 700 chars. The directory = all cards, sorted by `lastActivityAt`.
- **Large fleets:** if the directory is > 6000 chars (≈ 20+ Dots), Super's prompt gets the top 12 cards by a lexical relevance score (BM25-lite over card text vs
  the latest user message, implemented in `directory.ts` with a tiny tokenizer, no deps) plus a one-line list of all other Dot names. Super can always call `list_dots`.
- Injection: an inline extension on the Super session handles `before_agent_start` and sets
  `event.systemPromptOptions.sections["your_dots"] = directoryText` (pi 1.0.2: `sections` = "additional XML-wrapped prompt sections keyed by tag name";
  names must match `/^[a-z][a-z0-9_-]*$/`). pi sends a transcript delta when a section changes, so the prompt cache survives. Rebuilt every turn, so it is always current.

## 3. Knowledge summaries (`DotProfileService`, T65)
- Each standard Dot's `profile.knowledgeSummary` is refreshed when (a) the Dot has settled after ≥ 10 new messages since the last refresh, or (b) 6 h have
  passed and it has new messages, or (c) `superbot.refreshProfiles()` is called.
- Refresh = one cheap `completeSimple` call with the Dot's model: input = the Dot's persona role + the last 40 messages of its main transcript (text only, PII-redacted
  if the Dot's model is cloud) + the previous summary; instruction: "In ≤ 120 words, state what you are currently tracking or know that the user might ask about.
  Facts only, newest first. No greetings." `maxTokens: 220`.
- It runs in the background queue with the lowest priority, and is never concurrent for the same Dot. Cost is counted into the Dot's usage. It is skipped when over budget.

## 4. Super's tools (`src/main/runtime/extensions/superbot.ts`, T66) — registered only on the Super session

```ts
ask_dots({ requests: Array<{ dot: string; question: string }> /* 1–6 */ })
```
- Runs all requests **in parallel** via `LinkBus.send(super, dot, question, chain=[superId], signal, { onDelta })` (extend `send` with an optional streaming callback, §5).
- Each request is policy-checked (subject `super`), counted, audited, and approval-gated exactly like `message_dot`. Default rule (§7) = auto.
- Returns when all requests have settled (timeout per request `links.replyTimeoutSec`): text content =
  ```
  ## Inbox
  <reply>
  ## Calendar
  (no reply: <reason>)
  ```
  `details` = per-request status, durations, and peer ids (the UI renders the fan-out from the stream, not from this).
- `executionMode: "parallel"`, `annotations: { readOnlyHint: true }` (asking is not an external side effect; the target Dots gate their own actions).

```ts
get_dot_updates({ dot?: string; since?: string /* ISO or "today" | "1h" | "24h" */; limit?: number /* ≤ 50 */ })
```
- **No model call. Instant.** Returns recent events (titles, times, status) and the Dot's last visible `[UPDATE]/[URGENT]` messages (text, time) from
  `events/<dotId>.jsonl` and history. Without `dot`: across all visible Dots. Use it for "what's new?" questions.

```ts
search_dot_history({ dot: string; query: string; limit?: number /* ≤ 20 */ })
```
- Local, case-insensitive term search over the Dot's main transcript (user + assistant text), returning matching snippets (±200 chars) with timestamps.
  Allowed only when the Dot isn't `hiddenFromSuper`.

```ts
list_dots()  // the same tool as spec 07, plus each Dot's one-line "Does"
```

Super's persona (`templates/super.json`, role text):
```
You are Super, the user's lead assistant. You don't do tasks yourself: you find out which of the user's Dots can answer, ask them, and
combine their answers into one clear reply.
How to work:
1. Read "Your Dots" to decide who knows. For "what's new / anything important" questions, call get_dot_updates first, because it is instant.
2. When you need a Dot to think, look things up or act, call ask_dots ONCE with all the Dots you need, in parallel. Give each Dot a self-contained question.
3. Answer with the result first. Attribute facts inline like [Inbox] or [Calendar]. Note disagreements or gaps ("Calendar didn't respond").
4. If no Dot can answer, say which Dot could be set up for it (e.g. "connect Gmail to Inbox").
5. Never invent what a Dot said.
```
Voice: direct, verbosity 40, formality 50, emoji 0.

**@mention fast path (T66):** a user message to Super that starts with `@Name ` (one Dot) skips routing: `DotHost.send` on the Super host calls
`LinkBus.send(super, Name, rest)` directly, streams the reply as Super's assistant message, prefixed with a small "via Inbox" label, and records
both messages in the Super transcript (custom messages: `opendot.direct-ask` for the request, `opendot.direct-reply` for the answer, both `display: true`), so later turns have the context.
`@A @B question` → becomes one `ask_dots` call executed by OpenDot without the model, followed by a normal model turn for the synthesis.

## 5. Streaming the fan-out (T66 main, T67 UI)

- `LinkBus.send(..., { onDelta(peerDotId, event) })`: the target's `runLinkTurn` subscribes to its link session's events and forwards `text_delta`s
  (PII-restored on the target side, then re-masked if `sharePii` is false) and status changes.
- The Super DotHost turns these into `peer-stream` ChatEvents `{ toolCallId, peerDotId, status, seq, delta }`, at most one per 16 ms per peer (coalesced).
- UI (in Super's chat, rendered from the `ask_dots` tool call): a **fan-out card**: one row per Dot (avatar, name, status: queued → "thinking…" → streaming text
  (last 3 lines visible, expand for full) → ✓ done (duration) / ⚠ error / ⛔ blocked (reason)). The rows appear the moment `toolcall_end` arrives
  (the first visible feedback within ~1 token of Super deciding). Super's own synthesis then streams below the card in the same bubble.
- Citations: `[Inbox]` in the synthesised text renders as a small chip with that Dot's color; clicking it scrolls the fan-out card to that row
  (or opens the Dot). Implement as a remark plugin in `Markdown` that converts `[Name]` only when Name is a known Dot name.

## 6. Briefings (optional, T67)

> Superseded by the Daily briefing feature (`src/main/briefing`, Settings → Daily briefing): a dedicated scheduler runs a Super turn with a hidden `opendot.briefing` message, replies render as a briefing card, and the last run date lives in `~/.opendot/briefing.json`. The schedule-watcher preset below is the older design.

In Super's Dot Info "Always on" section, the "Briefing" preset adds a `schedule` watcher (default weekdays 08:30) whose standing instruction is:
"Call get_dot_updates for the last 24 h, then ask_dots only where you need detail. Post a briefing: urgent first, then today's schedule, then
everything else in one line each." It is delivered like any event (spec 12 §2.3) and streams into Super's chat. Notification "Your briefing is ready".

## 7. RBAC for Super (spec 07 additions)
- New subject `{ kind: "super" }`: matches the Dot whose `kind === "super"`. Specificity score 2 (same as a specific Dot).
- On first run, seed one rule: `from: super → to: any, effect: allow, approval: auto, maxPerHour: 60, sharePii: true, purpose: "Answer the user's questions via Super"`.
  Users can restrict it (e.g. `deny super → role:finance`) or require approval.
- `hiddenFromSuper` on a Dot is a hard deny that overrides any rule (checked before rule matching, reason "Hidden from Super").
- Super's link sessions on target Dots live at `sessions/<target>/links/<superId>/` like any sender.
- Add decision-table cases to T37: (19) seeded super→any rule, Super → Inbox → allow auto; (20) + deny super→role:finance, target Ledger(finance) → deny;
  (21) target hiddenFromSuper → deny "Hidden from Super"; (22) a standard Dot A with rule any→any allow, A → Super → allow (Dots may ask Super too, but chain rules still apply).

## 8. Super UI summary (T67)
- The list row is pinned first, with the brand mark avatar and the preview of the last synthesis.
- Its empty state shows suggestion chips built from the directory: "What's new today?", "Anything urgent?", "What's on my calendar tomorrow?" (only when such a Dot exists), "@Inbox …".
- Composer: `@` opens a Dot picker (avatars + names); the selected mentions render as chips in the textarea overlay (plain text `@Name` underneath).
- Dot Info for Super: the identity, personality and model sections are the same as other Dots; it adds a "Directory" section (read-only preview of what Super sees, with
  "Refresh knowledge" → `superbot.refreshProfiles`), a "Visibility" list (each Dot with a "Super can ask" switch = `!hiddenFromSuper`), and Briefing.
