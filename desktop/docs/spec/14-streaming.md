# Spec 14 — Streaming (first token → screen, everywhere)

**Contract (golden rule 11 in PLAN.md):** any model output the user can see is rendered **incrementally from the first token**.
No feature may wait for a complete response before showing something. This covers: chat replies, thinking, tool-call
arguments, event replies of always-on Dots (spec 12), Dot-to-Dot replies (spec 07), Super's fan-out and synthesis (spec 13),
and the "Describe a Dot" generator (spec 08 §5).

## 1. Pipeline & latency budget

```
provider SSE ─▶ pi-ai stream ─▶ AgentSession "message_update" (assistantMessageEvent: text_delta | thinking_delta | toolcall_*)
   ─▶ DotHost StreamEmitter (PII StreamRestorer, tag holdback) ─▶ IPC "dot:event" (message-delta, seq)
   ─▶ preload ─▶ chat store (append) ─▶ StreamingMarkdown (re-parse only the tail block) ─▶ paint
```
| Hop | Budget |
|---|---|
| pi delta → IPC send (main) | ≤ 5 ms per delta (no awaits on this path; no disk I/O; no logging of content) |
| first delta of a message | sent **immediately** (leading edge), never coalesced |
| later deltas | coalesced per message into ≤ 1 IPC message per **16 ms** (one frame) |
| IPC → store → paint | ≤ 1 frame (16 ms) for typical deltas; ≤ 50 ms worst case on a 20k-char message |
| snapshot | full `message-update` every 1000 ms while streaming + once at `message_end` |
| **TTFT on screen** | ≤ (provider TTFT + 50 ms), measured in e2e (§5) |

## 2. Main process: `StreamEmitter` (`src/main/runtime/stream-emitter.ts`, T55)

One per DotHost. API:
```ts
export class StreamEmitter {
	constructor(opts: { dotId: DotId; emit: (e: ChatEvent) => void; restore: (s: string) => string; now?: () => number; frameMs?: number /* 16 */; snapshotMs?: number /* 1000 */ });
	start(messageId: MessageId, opts?: { tagHoldback?: boolean }): void;  // assistant message_start
	text(delta: string): void;                                             // text_delta
	thinking(delta: string): void;                                         // thinking_delta
	toolArgs(toolCallId: string, delta: string): void;                     // toolcall_delta
	end(final: { text: string; thinking?: string }): void;                 // message_end: flush, final snapshot
	abort(): void;
}
```
Rules:
- Per message it keeps `raw` (the provider text, which may contain PII tokens), `shown` (what the UI has, restored), `pending` (restored text not yet sent), `seq`.
- **StreamRestorer:** on each text delta, append to `raw`; find the longest prefix of `raw` that contains no *unclosed* `⟦` (an open bracket without `⟧`);
  if an unclosed token is longer than 40 chars, treat it as literal text. Restore that safe prefix with `restore()`; `newShown = restored(safePrefix)`;
  the delta to send = `newShown.slice(shown.length)` (restoration only ever *replaces whole tokens* inside the safe prefix, so `shown` is always a prefix of `newShown`;
  assert it in dev and fall back to a snapshot if it isn't).
- **Tag holdback** (always-on event replies, spec 12 §3): until the first non-whitespace 12 chars are known (or the message ends), send nothing. Then:
  `NO_UPDATE` → suppress the whole message (no deltas, final `message-end` with `importance: "quiet"` and hidden); `[UPDATE]`/`[URGENT]` → strip the tag and set
  `importance` on `message-start`… since `message-start` was already sent, send it **lazily**: for holdback messages, `message-start` is emitted together
  with the first released delta.
- Frame coalescing: the first delta → emit now. Later deltas are accumulated and flushed by a `setTimeout(frameMs)` scheduled on the first pending delta (not `setInterval`).
- Snapshots: every `snapshotMs` while there were deltas, and at `end()`: `message-update { seq, text: shown, thinking }`. `seq` is shared between deltas and snapshots of the same message.
- Tool call args: `toolcall_start` → emit `tool-start` with status `"running"`, `label` from the tool name, args `{}` **immediately** (the chip appears before the arguments finish streaming);
  `toolcall_delta` → `tool-args-delta` (coalesced per frame); `toolcall_end` → `tool-update` with the parsed, restored args.
- Thinking: same path (`thinking` field on deltas), shown live inside a collapsed "Thinking…" section (expanded live if the user opened it).

The event-mapper (spec 03 §5) delegates `message_update` handling to the StreamEmitter, keyed by `assistantMessageEvent.type`. The previous
"throttle full text to 50 ms" rule in spec 03 §5 is **replaced** by this spec.

## 3. Other streamed surfaces
| Surface | Source of deltas | Shown as |
|---|---|---|
| Always-on reply | the Dot's main session (same emitter, `tagHoldback: true` when the triggering message is `opendot.events`) | a normal bubble streaming under the event card |
| `message_dot` (A asks B) | B's link session events → `LinkBus.send` `onDelta` → A's host emits `peer-stream` | the LinkCard's reply quote streams live |
| `ask_dots` (Super) | each target's link session → `peer-stream` per peer | fan-out card rows stream in parallel (spec 13 §5) |
| Super synthesis | Super's session (StreamEmitter) | the bubble below the fan-out card |
| Describe-a-Dot | `modelRuntime.streamSimple(...)` in `dot-architect.ts`; forward text deltas over a `dots:draft-stream` event `{ requestId, delta }` (add to EventMap; `draftFromDescription` takes an optional `requestId`) | the Describe step shows the JSON-free live preview: as fields complete in the partial JSON (`name`, `tagline`, `role`), they fill the preview card (parse with a tolerant partial-JSON reader: try `JSON.parse(text + closers)` for the accumulated text, ignore failures) |
| Knowledge summaries, catalog checks | not user-facing streams | spinner only |

## 4. Renderer

- **Store** (`stores/chat.ts`): `byDot[dotId].messages` is an array, but streaming updates replace **only that one message object** (`messages[i] = { ...m, text: m.text + d }`)
  plus the array copy. Components subscribe with selectors per message id (`useChat((s) => s.byDot[dotId]?.byId[messageId])`), so siblings don't re-render.
  Keep `byId: Record<MessageId, ChatMessageView>` + `order: MessageId[]` for this.
- **StreamingMarkdown** (`features/chats/StreamingMarkdown.tsx`, T56):
  - Split the text into blocks at blank lines **outside** fenced code (track ``` fences; an unclosed fence = the tail block).
  - Render each completed block with `<MemoBlock text=… />` (`React.memo`, keyed by index + text). Only the last (open) block re-parses on every update.
  - An open code fence renders as a code block immediately (the highlighter runs only when the fence closes, to avoid re-highlighting per token).
  - The end of streaming text shows the **streaming dot**: a 6px accent dot with a soft pulse (the brand motif), removed on `message-end`.
- **Scrolling:** Virtuoso `followOutput` keeps up while the user is at the bottom. If the user scrolled up, nothing jumps and the "↓ New" pill shows.
- **Hidden window:** Chromium throttles hidden renderers. That's fine: the snapshots resync. On `show`, the renderer calls `chat.history` for the open Dot to re-baseline.
- **List preview:** while a Dot streams, its row shows "typing…" (accent). On `message-end`, the preview updates to the final text.
- **Typing indicator → bubble:** the TypingIndicator bubble morphs into the message bubble on the first delta (same position and size; no layout jump).

## 5. Measuring it (T55 unit tests, T68 e2e)

Unit (fake clock): deltas `"Hel"`, `"lo ⟦EMA"`, `"IL_1⟧ there"` with vault `⟦EMAIL_1⟧ → a@b.co` produce shown `"Hel"` (immediately), `"lo "` (frame), then
`"a@b.co there"`; the final snapshot equals `restore(raw)`; `seq` is strictly increasing; at most 1 emit per 16 ms after the first.
Tag holdback: `"NO_"`, `"UPDATE"` → zero deltas and a hidden final; `"[URG"`, `"ENT] Server down"` → message-start with `importance: urgent`, shown `"Server down"`.

Timing marks: `ChatMessageView.timing.sentAt` (renderer, when the user hits Enter), `firstTokenAt` (main, the first text delta received from pi, sent along in `message-start`
and the first delta), and the renderer mark `performance.mark("od:first-paint:<id>")` in a `useLayoutEffect` when the first text renders.
In E2E mode only, the renderer reports `{ messageId, firstPaint }` via `window.opendotTest.reportPaint` so the test asserts:
- `firstPaint - firstTokenAt ≤ 50 ms` (fake provider, 400 tokens/s, M-series CI runner; allow 100 ms on Intel)
- the final rendered text === the fake script's text (no lost or duplicated deltas), for a 10k-char reply with code fences
- frame rate during that stream ≥ 50 fps (Playwright `page.evaluate` with a rAF counter)
