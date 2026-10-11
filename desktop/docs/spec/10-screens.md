# Spec 10 — Screens, layouts, states, copy

Window minimum 900×600. Default 1280×820. The title bar is hidden (`hiddenInset`); traffic lights sit at (18, 18) over the nav rail.

## 1. App frame

```
┌──────┬──────────────────────┬───────────────────────────────────────────────┬────────────────┐
│ Rail │ List pane            │ Main pane                                     │ Right drawer   │
│ 64px │ 360px (300–480,      │ flex-1                                        │ 380px (toggle) │
│      │ drag handle 4px)     │                                               │                │
│ 🟢•• │ ┌──────────────────┐ │ ┌───────────────────────────────────────────┐ │                │
│      │ │ Chats      ✎ ⋯  │ │ │ ◉ Inbox · using Gmail…   🛡 ⓘ ⋯         │ │                │
│ 💬   │ │ 🔍 Search Dots   │ │ ├───────────────────────────────────────────┤ │                │
│ 🔗   │ │ [All][Unread][📌]│ │ │        (dot-grid wallpaper)               │ │                │
│ 🔌   │ │ ● Inbox    10:42 │ │ │   ┌─────────────────┐                     │ │                │
│      │ │   Top priority… 2│ │ │   │ Dot bubble      │                     │ │                │
│      │ │ ● Calendar  9:10 │ │ │   └─────────────────┘   ┌──────────────┐  │ │                │
│      │ │   thinking…      │ │ │                         │ User bubble  │  │ │                │
│ ⚙    │ │ …                │ │ │                         └──────────────┘  │ │                │
│ (me) │ └──────────────────┘ │ ├───────────────────────────────────────────┤ │                │
│      │                      │ │ (+)  Message Inbox…                 (↑)  │ │                │
└──────┴──────────────────────┴───────────────────────────────────────────────┴────────────────┘
```
- The top 40px of the list and main panes is a drag region (`od-drag`). Interactive elements inside use `od-no-drag`.
- Rail (bg rail, border-right subtle): app mark (24px) at y=52, then nav items (IconButton lg, 20px icons): **Chats** (MessageCircle), **Dot Links** (Waypoints),
  **Activity** (Radar, spec 12 §5), **Connections** (Plug). Bottom: **Approvals** (ShieldCheck, with a badge count when pending), **Settings** (Settings). Active item: accent-subtle bg + accent icon + a 3px accent bar at the left edge.
- The right drawer is only available on Chats when a Dot is selected. Toggle with the ⓘ button or ⌘I.

## 2. Routing, shortcuts, persistence

### 2.1 Routes (hash)
`#/chats` · `#/chats/:dotId` · `#/links` · `#/activity` · `#/connections` · `#/connections/:connectionId` · `#/settings/:section`
(sections: `general`, `models`, `privacy`, `background`, `notifications`, `advanced`, `audit`, `about`) · `#/gallery` (dev) · `#/onboarding`.
### 2.2 Layout persistence
The list width and drawer open state are saved in `settings.window` (debounced).
### 2.3 Empty main pane (no Dot selected)
EmptyState: the brand mark, "Pick a Dot to start chatting", the secondary line "Each Dot is an assistant with its own skills and personality.", and the button "New Dot".
### 2.4 Shortcuts
| Keys | Action |
|---|---|
| ⌘N | New Dot dialog |
| ⌘K | Focus search |
| ⌘1…⌘9 | Open the nth Dot in the list |
| ⌥⌘↑ / ⌥⌘↓ | Previous / next Dot |
| ⌘I | Toggle Dot Info drawer |
| ⌘, | Settings |
| ⌘L | Dot Links |
| ⌘⇧C | Connections |
| Esc | Stop generating (when composer focused & streaming); close drawer/dialog otherwise |
| ⌘↵ | Send as steer (interrupt) while streaming |
| ⌘⇧⌫ | Clear chat (confirm) |

## 3. Chats

### 3.1 List pane
- Header (h 60): "Chats" (text-2xl semibold), IconButtons: New Dot (SquarePen, ⌘N) and ⋯ (Show archived, Sort by: Recent / Name / Pinned first).
- Search Input (pill). Filters (SegmentedControl, small): All · Unread · Pinned.
- Virtualised list of DotListItem (react-virtuoso). Sort: **Super first (always)**, then pinned (by pin time), then `lastActivityAt` desc. When a Dot gets activity it animates to its new position.
- Empty (no Dots): EmptyState "No Dots yet" + "Create your first Dot" + "Browse templates".
- No search results: "No Dots match “x”".

### 3.2 Chat view
- **Header** (h 60, bg sidebar, border-bottom subtle): Avatar md + name (text-lg semibold) + a status line (text-xs; idle → tagline in fg-3;
  live status in accent: "thinking…", "typing…", "using Gmail…", "waiting for your approval", "talking to Calendar…"; error in danger).
  Right: model chip (text-xs, bg sunken, radius full, e.g. "claude-sonnet · 🔒 local" when local), PiiBadge state, ⚠ chip if a granted
  connection is in error (click → Connections), ⓘ (drawer), ⋯ menu (Clear chat, Copy chat as Markdown (renderer-only, to clipboard), Mute, Pin, Delete).
- **Message list**: `od-chat-wallpaper`, a centered column with max-w `--od-chat-max-w`, padding 16 24. Virtuoso with `followOutput="smooth"` only when
  at the bottom. Top: "Load earlier messages" on scroll-to-top (`chat.history` with `before`). Day separators.
  First-run state for a new Dot: its greeting bubble plus 3 suggestion chips under it (from the template: e.g. "Summarise today's unread", "Draft a reply to…"). Clicking one fills the composer.
- **"↓ N new"** floating pill (bottom-right of the list) when not at the bottom and new messages arrive.
- **Link cards** (`link-out`/`link-in`) and **system notices** (centered, bubble-system, text-xs: "Model changed to …", "Summarised older messages", "Retrying (2/3)…").
- **Errors**: inline in the failed bubble, plus a toast for non-retryable configuration errors with an action ("Open Settings").

### 3.3 Composer
Spec 09 §4.23. Behaviour:
- Enter = send. Shift+Enter = newline. When streaming: Enter = follow-up (queued, shown as a faded user bubble with the "queued" label until it is delivered), ⌘↵ = steer.
- Empty or whitespace input → send is disabled. Max 100 000 chars (counter appears above 90%).
- Draft per Dot preserved when switching Dots (in memory, plus localStorage key `od:draft:<dotId>` debounced).
- `/` at the start opens a small command menu: `/clear`, `/model`, `/persona`, `/links` (client-side shortcuts that open the respective UI; they are not sent to pi).

### 3.4 Approvals
- Inline ApprovalCard in the requesting Dot's chat (at the bottom, above the composer, sticky until resolved).
- The rail badge counts all pending. Clicking it opens the **Approvals** screen (`#/approvals[/<id>]`) with two tabs, **Waiting** (cards with Dot, plain-language action, why, readable details; Allow once / Edit, then allow / Always allow for this Dot / Deny with an optional reason; keys A, D, E; grouped by Dot with Deny all from 3 requests) and **History** (decided approvals from the audit log, filter by Dot and outcome).
- A native notification when the window is not focused.

### 3.5 Privacy indicator
PiiBadge in the header: "🛡 Private" (accent) when redaction is active, "🛡 Off" (fg-3) otherwise. Click → popover: an explanation, the current
provider, "Masked this chat: 4 emails, 1 phone", and a link "Privacy settings".

## 4. Dot creation & customisation

### 4.1 New Dot dialog (lg, 720px) — 2 steps: **Describe → Review**
1. **Describe** (the default step):
   - TextArea **"What should this Dot do?"** (required, 10–2000 chars, autoGrow 4–10 lines). Placeholder: "Watch my inbox for client emails, summarise
     them every morning and draft replies in my tone." Example chips under it (from templates) prefill the prompt AND the connectors.
   - **"Connectors it can use (optional)"**: a searchable chip grid of `dots.connectorChoices()`, grouped as **Installed** (Gmail, Calendar, my MCP servers…) and
     **Available** (Google: Gmail/Calendar/Drive, Microsoft: Mail/Calendar/OneDrive/Teams, Mac: Files/Shell/Calendar/Reminders/Contacts/Notes/Screen, and catalog MCPs).
     Each chip: icon + label + a ✓ when selected. Available ones show a small "set up later" hint. Multi-select.
   - Footer: "Browse templates" (link → a popover with the 10 templates) · **Create personality** (primary). The loading state streams the identity into a preview
     card as it is generated (name → emoji → tagline → role text typing in), using the typing-dots motif.
2. **Review**: left: a live DotListItem preview + the greeting bubble. Right: name, emoji picker (a curated grid of 120 emoji + search), color swatches (12), tagline,
   tone (SegmentedControl), the 3 sliders, and collapsible role/quirks/dos/donts. "Connectors": the chosen ones with status (Installed ✓ / "Set up after creating").
   "Always on": a Switch (pre-set by the generator) + the suggested watchers as checkboxes. Model: Select (default first). Footer: Back · **Create Dot**.
After creation: the dialog closes, the new Dot is selected, and the greeting appears. The greeting is never sent to the model: `DotHost.history()` prepends a
synthetic assistant message (id `greeting_<dotId>`) built from `persona.greeting`. If some chosen connectors aren't installed, a setup card follows the greeting
with one button per connector.

### 4.2 Dot Info drawer (Sheet) — sections in a scroll, each a card with a header
0. **Always on** (spec 12 §5): only for standard Dots, and for Super (briefing only).
1. **Identity**: large avatar (xl), editable name, emoji, color, tagline, roles (chip input, suggestions: assistant, comms, scheduling, research, dev, finance, personal, trusted).
2. **Personality** (PersonaSection): role textarea, tone, sliders, quirks chips, Always/Never lists, custom instructions (collapsible "Advanced"), greeting.
   A "Preview prompt" button opens a Dialog with the compiled system prompt (read-only, mono). "Reset to template".
3. **Model** (ModelSection): model Select (Default / any model) + thinking level SegmentedControl (Off · Low · Medium · High; extra levels only when the model supports them).
4. **Tools** (ToolsSection, §4.4).
5. **Privacy** (PrivacySection): PII mode (Auto (recommended) · Always · Off) with a one-line explanation per option; current provider locality.
6. **Dot Links** (LinksSection): "Can message:" and "Can be messaged by:" (computed from rules, with an "Edit in Dot Links" link); roles editor shortcut.
7. **Workspace**: folder path + "Change…" (folder picker via `app.pickFolder()`) + "Reveal in Finder".
8. **Danger zone**: Clear chat, Archive, Delete (type the name to confirm).
Changes save on blur/commit (debounced 400 ms) with an inline "Saved" tick. A persona/grant change shows the toast "Applies from the next message".

### 4.3 Model section details
Show the "local 🔒" badge and the context window. If the selected model is missing (provider removed): a warning plus "Using default instead".

### 4.4 Tools section
- A list of installed connections with a Switch "Allowed for this Dot". When on: expandable per-tool rows: tool name, description (1 line), and a decision SegmentedControl
  **Allow · Ask · Block** (default shows the computed default with "(default)").
- The `mac` connection shows its capabilities as individual switches (Files, Shell, Calendar, …). Files has "Allowed folders" (+ add folder).
- "Install more" → `#/connections`.
- Footer: "Always-allowed actions" list (from policy.json) with a remove ✕ for each.

## 5. Connections

### 5.1 Layout
Main pane (no list pane on this route: the list pane collapses and the main pane takes the full width, max-w 1100 centred).
Header "Connections" + subtitle "Give your Dots tools. Each Dot only gets what you allow it." + buttons: **Add MCP server**, **Import JSON**.
Tabs: **Installed** · **Catalog** · **Mac** · **Google & Microsoft**.

### 5.2 Installed / Catalog
- Installed: a grid of ConnectionCards (3 columns ≥ 1100px, 2 columns otherwise). The card shows the "Used by N Dots" avatars stack.
- Catalog: category filter chips + search. Cards with **Install**. Unverified entries are hidden unless the toggle "Show unverified" is on (with a warning).
- Install flow: a Dialog with the inputs from the catalog entry (secret inputs masked), a "Test connection" button (calls `connections.check`) → the result (tools found), then **Install**.
- Add MCP server dialog: Type (Local command / Remote URL). Local: command, args (one per line), env editor (key, value, "secret" toggle). Remote: URL, headers editor
  (secret toggle), auth (None / Bearer token / OAuth). Name (auto-slug). Then Test → Install.
- Import JSON dialog: a textarea "Paste your mcpServers JSON (Claude Desktop, Cursor, VS Code)". A preview list of the servers found, with checkboxes, plus warnings.
- Connection detail (`#/connections/:id`): status + error with the stderr tail (mono), the tools table (name, description, read-only/destructive badges, exposure Select),
  "Used by" Dots with links, Reconnect/Test, Sign in/out (OAuth), Edit config, Remove (confirm).

### 5.3 Mac tab (T28)
A list of capabilities: icon, name, one-line description, a permission StatusPill (Granted / Not allowed / Not asked yet / Not required), and buttons:
"Request access" (when not determined) and "Open System Settings" (deep link). Info box: "macOS asks once per capability. If you denied it, enable OpenDot in System Settings."

### 5.4 Google & Microsoft tab (T33)
Two cards. Each: not configured → **Set up** → a wizard Dialog: step 1 instructions (spec 05 §5.3 text, numbered, links open externally),
step 2 paste the Client ID (and the secret for Google), step 3 choose the features (Gmail, Calendar, Drive / Mail, Calendar, OneDrive, Teams), step 4 **Sign in with Google/Microsoft**
→ waiting state ("Finish signing in in your browser…") → success: "Connected as you@example.com". Configured cards show the account, features (toggles), Sign out, and Remove.

## 6. Settings (`#/settings/:section`, left sub-nav inside the list pane)

### 6.1 Models
Spec 04 §5. Sections: **Default model** (Select + "Test"), **Cloud providers** (cards + "Add provider" → Dialog: provider Select with logos/labels,
a key field with "Get a key" link, Test & Save), **On this Mac** (detected local servers with "Add"; manual add), **Custom endpoints** (Add → Dialog:
label, base URL, API type Select (OpenAI-compatible chat / OpenAI Responses / Anthropic-compatible), key, headers, models (Discover / manual list)).
### 6.2 General
Theme (System / Light / Dark), accent color swatches (Dot palette), launch at login (Switch → `app.setLoginItemSettings`), language (English only in v1, disabled).
### 6.3 Privacy
PII types checklist, custom terms list (term + type), detect names Switch, the "Try it" box (TextArea → highlighted preview), and an explanation of what is and isn't protected.
### 6.4 Notifications
Enabled, sound, show message preview.
### 6.5 Audit log (T40)
Filters (Dot, kind, date range), a virtualised table (time, Dot, kind badge, summary), Export JSONL.
### 6.6 Advanced
Dot Links global daily budget, max hops, reply timeout; idle dispose minutes; max concurrent runs; "Open data folder"; "Reset OpenDot" (danger, type RESET).
### 6.7 About
Version, pi version, licenses (MIT; link to the pi repo), "Check for updates" (opens GitHub Releases in v1).

## 7. Dot Links screen (`#/links`, T39)
Full-width layout like Connections. Header "Dot Links" + subtitle "Decide which Dots can talk to each other, and when." + **New rule**.
- Left (60%): **LinkGraph**: an SVG circle layout (radius scales with count, Dot avatars as nodes 40px, labels under them). Edges: curved arrows; solid accent = auto, dashed accent = ask,
  danger dashed with ✕ = explicit deny. Hover a node → highlight its edges. Click an edge → open the rule.
- Right (40%): **Rules** table (from → to (subject chips: Dot avatar or role chip `#finance` or "Any Dot"), effect, approval, hours summary "Mon–Fri 9–18", rate "10/h", PII icon, enabled Switch, ⋯).
- **Rule editor dialog**: From (Select: Dots, roles, Any) · To (same) · Effect (Allow / Block) · Approval (Ask me each time / Automatic) · When (Any time / Schedule: day toggles M T W T F S S, start/end time inputs, time zone Select default system) ·
  Rate limit (Slider 1–120 per hour, default 10) · Share personal details (Switch, default off, help: "When off, personal details stay masked between Dots") · Purpose (Input).
  A live "Effective result" line at the bottom using `links.simulate` for the selected Dots.
- **Test box**: "Can [Dot] message [Dot] right now?" → result with the reason.
- **Activity** (below): exchanges list (time, A → B, status badge, request snippet) → click opens the transcript Sheet.
- Empty state: "Dots can't talk to each other yet" + an illustration of two dots + "Create a rule" + a template button: "Let Compass coordinate all Dots (ask each time)".

## 8. Onboarding (`#/onboarding`, T46) — full-window, centred card max-w 560
1. **Welcome**: brand mark (animated typing dots), "Meet your Dots", the line "A team of AI assistants that live on your Mac. You choose the models, the tools, and who talks to whom.", button "Get started".
2. **Choose a brain**: three option cards: "Use a cloud model" (provider Select + key + "Get a key"), "Use a model on this Mac" (auto-detect Ollama/LM Studio, shows the found models, link "Install Ollama"),
   "Connect to a URL" (custom). Test runs inline. "Skip for now" (link).
3. **Pick your first Dots**: template cards with checkboxes, 3 preselected (Dot, Inbox, Calendar). Create.
4. **Privacy promise**: "Your chats, keys and settings stay on this Mac. Personal details are masked before they reach cloud models. Dots can't use tools or talk to each other unless you allow it." → "Start chatting".
Sets `onboardingDone`.

## 9. Notifications, dock, menu (T47)
- A native notification on assistant `message-end` when the window is unfocused OR the Dot is not selected, the Dot is not muted, and notifications are enabled. Title = Dot name,
  body = preview (or "New message" if previews are off). Click → focus the window + `app:focus-dot`.
- Dock badge = total unread (`app.dock.setBadge`). Hidden at 0.
- App menu: OpenDot (About, Settings ⌘,, Quit), File (New Dot ⌘N), Edit (standard roles), View (Toggle Dot Info ⌘I, Reload (dev), Toggle DevTools (dev)), Window, Help (User guide → GitHub).

## 10. Polish checklist (T48)
- [ ] Every interactive element has hover, active, focus-visible and disabled states
- [ ] No layout shift when streaming starts (the typing indicator occupies the same height as a 1-line bubble)
- [ ] Long words and URLs wrap in bubbles (`overflow-wrap: anywhere`); code blocks scroll horizontally
- [ ] Dark mode check on every screen (screenshots in e2e for both themes)
- [ ] Reduced motion: no transforms, instant transitions
- [ ] VoiceOver: list items announce "Inbox, 2 unread, last message …"; bubbles have `role="article"` with the author; live status in an `aria-live="polite"` region
- [ ] Keyboard-only: complete the golden path (create a Dot, chat, approve) without a mouse
- [ ] 1,000-message chat scrolls at 60 fps (virtualised), switching Dots < 100 ms with cached history
- [ ] Window at 900×600: no clipped controls; the drawer overlays instead of pushing below 1100px width
- [ ] Copy uses sentence case, and there's no "AI" jargon in errors
