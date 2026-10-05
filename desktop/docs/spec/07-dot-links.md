# Spec 07 — Dot Links: Dot-to-Dot messaging with RBAC

## 1. Concept

A Dot can ask another Dot something, e.g. Inbox asks Calendar "Am I free Thursday 3pm?". This only works
if an **allow rule** matches, no **deny rule** matches, the rule's **schedule** is open, the **rate limit**
has room, the global **daily budget** has room, and (when `approval: "ask"`) the **user approves**.
Default: **deny everything**.

## 2. Subjects & roles

- Every Dot has `roles: string[]` (lowercase `[a-z0-9-]`, max 8). Templates set sensible roles, for example
  `assistant`, `comms`, `scheduling`, `research`, `finance`, `dev`, `trusted`.
- Rule subjects: a specific Dot, a role, or `any`.

## 3. Policy (`src/main/links/link-policy.ts`, T37)

```ts
export interface LinkPolicyInput { from: Dot; to: Dot; now: Date; rules: DotLink[]; counters: LinkCounters; settings: AppSettings["links"]; chain: DotId[] }
export function decideLink(input: LinkPolicyInput): LinkDecision;
export interface LinkCounters { pairLastHour(from: DotId, to: DotId, now: Date): number; globalToday(now: Date): number }
```

### 3.1 Algorithm
1. `from.id === to.id` → deny "A Dot can't message itself".
2. `to.archived` → deny "Target is archived".
3. `chain.includes(to.id)` → deny "Loop detected: A → B → A".
4. `chain.length >= settings.maxDepth` (default 3) → deny "Too many hops".
5. Candidate rules = enabled rules where `matches(rule.from, from)` and `matches(rule.to, to)`.
   `matches({kind:"dot"}, d) = dotId === d.id`; `{kind:"role"}` → `d.roles.includes(role)`; `{kind:"super"}` → `d.kind === "super"`; `{kind:"any"}` → true.
   Before step 5: if `from.kind === "super"` and `to.hiddenFromSuper` → deny "Hidden from Super" (spec 13 §7).
6. Specificity score per side: dot = 2, super = 2, role = 1, any = 0. Rule score = from + to (0..4).
7. Take the max score among candidates. If **any deny** rule has that max score → deny (reason names the rule).
   Otherwise, if any allow rule has that score, pick the allow with: the most permissive schedule *currently open* first,
   then `approval: "auto"` before `"ask"`, then the oldest. If no candidates → deny "No rule allows <A> to message <B>".
   (Higher-specificity allow beats lower-specificity deny: "Finance is off limits to assistants (role→dot deny, score 3)
   but Planner may talk to Finance (dot→dot allow, score 4)".)
8. The chosen rule's schedule must be open at `now` in `schedule.timeZone`, else deny "Outside allowed hours (Mon–Fri 09:00–18:00 Europe/London)".
9. `counters.pairLastHour(from,to) >= rule.maxPerHour` → deny "Rate limit reached (10/hour)".
10. `counters.globalToday() >= settings.globalDailyBudget` → deny "Daily Dot-to-Dot budget used up".
11. Allow with `approval = rule.approval`, `ruleId`.

### 3.2 Schedule (`schedule.ts`)
`isOpen(s: LinkSchedule, now: Date): boolean`. Convert `now` to the zone with
`Intl.DateTimeFormat(…, { timeZone, weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts`.
If `end > start`: open iff the day ∈ days and start ≤ t < end. If `end < start` (crosses midnight): open iff
(day ∈ days and t ≥ start) **or** (previous day ∈ days and t < end). If `start === end`: open all day on the listed days.

### 3.3 Counters
Computed from `link-exchanges.jsonl` (status in running/done) in memory: an index rebuilt on startup, then
incremented on each exchange. "Today" = the local calendar day.

### 3.4 Decision table (T37 tests — all must pass)

| # | Rules | from (roles) | to (roles) | now | Expected |
|---|---|---|---|---|---|
| 1 | none | A | B | any | deny "No rule allows" |
| 2 | allow A→B auto | A | B | any | allow auto |
| 3 | allow A→B ask | A | B | any | allow ask |
| 4 | allow role:assistant→any | A(assistant) | B | any | allow |
| 5 | allow role:assistant→any; deny role:assistant→dot:F | A(assistant) | F | any | deny (score 3 > 1) |
| 6 | case 5 + allow dot:A→dot:F | A(assistant) | F | any | allow (score 4) |
| 7 | allow any→any; deny any→any | A | B | any | deny (same score, deny wins) |
| 8 | allow A→B, schedule Mon–Fri 09:00–18:00 UTC | A | B | Wed 10:00Z | allow |
| 9 | same | A | B | Sat 10:00Z | deny "Outside allowed hours" |
| 10 | allow A→B, schedule every day 22:00–06:00 Asia/Kolkata | A | B | Tue 01:00 IST (Mon in list) | allow (spill-over from Mon) |
| 11 | same, days=[Tue] only | A | B | Tue 01:00 IST | deny (spill-over needs Mon) |
| 12 | allow A→B maxPerHour 2, 2 exchanges in the last 59 min | A | B | — | deny "Rate limit" |
| 13 | allow A→B, chain [C, A] → B | A | B | — | allow (depth 2 < 3) |
| 14 | chain [A, B], target A | B | A | — | deny "Loop detected" |
| 15 | chain [A, B, C], target D | C | D | — | deny "Too many hops" |
| 16 | allow A→B, rule disabled | A | B | — | deny "No rule allows" |
| 17 | global budget 200, 200 today | A | B | — | deny "Daily … budget" |
| 18 | allow A→B, B archived | A | B | — | deny "Target is archived" |
| 19–22 | SuperBot cases | | | | see spec 13 §7 |

## 4. LinkBus (`src/main/links/link-bus.ts`, T38)

```ts
export interface LinkTurnRequest { exchangeId: string; from: Dot; to: Dot; message: string; purpose: string; chain: DotId[]; signal?: AbortSignal }
export class LinkBus {
	constructor(deps: { store: Store; runtime: () => DotRuntime; approvals: ApprovalBroker; pii: PiiService; log: Logger; emit: Emitter });
	send(from: Dot, toRef: string, message: string, chain: DotId[], signal?: AbortSignal): Promise<{ ok: true; reply: string } | { ok: false; reason: string }>;
	reachableFrom(from: Dot, now?: Date): Array<{ dot: Dot; approval: LinkApproval; purpose: string }>; // for list_dots
}
```
`send` steps:
1. Resolve `toRef` by exact id, then case-insensitive name. Not found → `{ ok:false, reason:"No Dot named …" }`.
2. `decideLink(...)`. Deny → audit `link-blocked` and return the reason (the model sees it and can tell the user).
3. Create a `LinkExchange` (status `pending-approval` or `running`), append it, emit `link:exchange`, and set
   `from`'s status to `talking-to`.
4. If `approval === "ask"` → `approvals.request({ kind:"link", title: "<A> wants to message <B>", detail: message (≤ 300 chars), linkId, peerDotId })`.
   Deny or expired → status `rejected` and return `{ ok:false, reason:"The user didn't allow this message." }`.
5. PII: `message` arrives restored (the tool_call hook restored it). If `!rule.sharePii` →
   `pii.redact(from.id, message)` (A's vault) so B sees tokens. Reply text comes back as-is (B's own masking applies inside B).
6. `runtime().get(to.id).runLinkTurn({ … chain: [...chain, to.id] })` with timeout `settings.links.replyTimeoutSec` (default 120 s).
7. Save the reply, set status `done`, audit `link-exchange` (ids, rule id, durations, char counts), emit. Return `{ ok:true, reply }`.
Errors → status `error`/`timeout`, return `{ ok:false, reason }`.

### 4.1 `DotHost.runLinkTurn` (target side)
- Uses a **separate pi session per sender**: `SessionManager.continueRecent(cwd, paths.dotLinkSessions(to.id, from.id))` (`~/.opendot/dots/<to>/links/<from>/`),
  built with the same extensions and grants as the main session (B's own tool policies and approvals apply), plus
  an extra system-prompt section:
  ```
  ## Incoming request from another Dot
  You are answering <A name> (<A tagline>), another assistant owned by the same user.
  Purpose of this link: <purpose or "not specified">.
  Reply with the information requested, concisely. Your final message is returned to <A name> verbatim.
  Do not ask the user questions in this conversation; if you can't proceed, say what is missing.
  ```
- Runs: `await session.prompt(message)`, then returns the last assistant text (restored).
- One run at a time per (to, from) link session (queue). It counts against `maxConcurrentRuns`.
- The `chain` for nested `message_dot` calls from B is held in the link session wrapper and read by B's links extension.
- B's link sessions are disposed with B's idle reaper.

## 5. Tools (`src/main/runtime/extensions/links.ts`, T38)

Registered in every Dot session (main and link sessions):

```ts
defineTool({
	name: "list_dots", label: "Dots", exposure: "direct",
	description: "List the other Dots (assistants) you may message right now, with what each one does.",
	parameters: Type.Object({}),
	annotations: { readOnlyHint: true },
	execute: async () => ({ content: [{ type: "text", text: formatReachable(linkBus.reachableFrom(dot)) }], details: undefined }),
});
defineTool({
	name: "message_dot", label: "Message a Dot", exposure: "direct",
	description: "Send a message to another Dot and wait for its reply. Use list_dots first. Only works where the user has allowed it.",
	parameters: Type.Object({
		to: Type.String({ description: "Dot name or id from list_dots" }),
		message: Type.String({ description: "Self-contained request. The other Dot cannot see this conversation." }),
	}),
	annotations: { openWorldHint: false, destructiveHint: false },
	executionMode: "sequential",
	execute: async (_id, p, signal) => {
		const r = await linkBus.send(currentDot(), p.to, p.message, chainFor(session), signal);
		if (!r.ok) throw new Error(r.reason);   // → error tool result the model can read
		return { content: [{ type: "text", text: r.reply }], details: { to: p.to } };
	},
});
```
If a Dot has **no** reachable Dots and no rules mention it, still register the tools (tool sets stay stable),
but `list_dots` returns "You can't message any Dots. The user can allow this in Dot Links."

## 6. UI (T39, spec 10 §7)

- **In A's chat:** a `message_dot` tool chip renders as a **link card**: the peer avatar, "Asked <B>", the request (collapsed
  to 2 lines), and the reply in a quoted block. Status: waiting approval / talking… / replied / blocked (reason).
- **In B's chat:** `link-in` timeline cards ("<A> asked: … · <B> replied: …"), merged from `LinkExchange`s by time
  (spec 03 §6), with "Open full exchange" → a Sheet that shows the link session transcript (via `chat.linkHistory(dotId, peerDotId)`,
  implemented in T38).
- **Dot Links screen:** a graph with Dots on a circle, arrows for effective allow pairs (solid = auto, dashed = ask, red ✕ for
  explicit denies), a rules table (from · to · effect · approval · hours · rate · PII · enabled), a rule editor dialog,
  a "Test" box ("Can <A> message <B> now?" → `links.simulate`), and an activity feed of exchanges.

## 7. Future (not v1)
Scheduled Dots ("every weekday 8:00, Briefing asks Inbox + Calendar and posts a summary") will reuse `LinkBus.send` with
`from = "user-schedule"`. That's why the bus takes a resolved sender rather than reading UI state.
