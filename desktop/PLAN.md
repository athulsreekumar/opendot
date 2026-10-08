# OpenDot — Master Build Plan

> An open-source, local-first macOS app for running a team of AI agents ("Dots").
> It looks and feels like WhatsApp Desktop. Each Dot is a chat. Every Dot runs on the
> **pi agent harness** (`@earendil-works/pi-coding-agent` SDK, MIT).

This file is the **single entry point**. It defines the orchestration protocol, the
locked decisions, the architecture at a glance, and the **task board**. Detailed specs
live in `docs/spec/` and every task names the spec sections it needs. **A worker only
reads this file plus the spec files its task card lists.**

---

## 0. How to use this plan

### 0.1 Roles

| Role | Model | Responsibility |
|---|---|---|
| **Orchestrator** | Opus | Owns this board. Dispatches tasks, reviews diffs against acceptance criteria, merges, resolves cross-task conflicts, updates the `Status` column. Never skips the review gate. |
| **Builder** | Sonnet | Tasks marked `S`. Anything with design judgement, concurrency, pi integration, security, OAuth, or multi-file UI. |
| **Implementer** | Haiku | Tasks marked `H`. Mechanical, fully specified work: tokens → CSS, a component from an exact spec, a JSON catalog, unit tests from listed cases, copy, icons. |

### 0.2 Dispatch protocol (Orchestrator)

1. Pick every task on the board whose dependencies are all `done`. Tasks without
   shared files can run in parallel, and the "Files" line on each card tells you which
   files a task touches.
2. Give the worker the **Worker Prompt Template** (§0.4) with the task ID filled in.
3. When the worker reports back, run the **Review Gate** (§0.5). On failure, send the
   exact failing command output back to the same worker (max 2 retries). After that,
   escalate the task to Sonnet, or take it yourself if a Sonnet task already failed twice.
4. Commit per task: `opendot: <TASK-ID> <title>`. One task, one commit.
5. Update the Status column in §6 (`todo` → `wip` → `done`).

### 0.3 Golden rules for every worker (non-negotiable)

1. **Read before writing.** Read every file you modify. Read the spec sections listed in your card.
2. **Stay inside your card's "Files" list.** You need another file? Stop and report it, don't edit it.
3. **Types come from `src/shared/types.ts` and IPC from `src/shared/ipc.ts`.** Never redefine a
   shared type locally. If a type is missing, report it; only the orchestrator or tasks
   `T02`/`T03` change shared contracts.
4. **No new dependencies** beyond `docs/spec/01-scaffold.md §3`. Need one? Stop and ask.
5. **Never put secrets in plain files, logs, or IPC to the renderer.** API keys and OAuth tokens
   go through `SecretStore` (spec 06 §2) and nothing else.
6. **The renderer never imports Node, Electron, or pi.** It only talks to `window.opendot` (spec 02 §3).
7. **Only design-system components and tokens in UI code.** No raw hex colors, no ad-hoc px font
   sizes, no inline `style={{}}` except dynamic values such as a Dot's accent color (spec 09).
8. **Every task ends green**: `npm run typecheck && npm run lint && npm test` from `opendot/`.
9. Prefer boring code. No clever abstractions. Match surrounding code.
10. Unsure about the pi API? Read the `.d.ts` in `node_modules/@earendil-works/pi-coding-agent/dist/`
    or the docs in `node_modules/@earendil-works/pi-coding-agent/docs/`. **Do not guess signatures.**
11. **Streaming is mandatory.** Any model output the user can see renders from the first token (spec 14). Never `await` a full
    response before showing something, and never block the delta path with I/O or logging.
12. **Main must never crash because of a Dot.** Always-on code catches, logs, backs off and keeps the app running (spec 12 §1).

### 0.4 Worker Prompt Template

```
You are implementing task <ID> of OpenDot.
Repository root: <path>/opendot
1. Read opendot/PLAN.md §0.3 (golden rules) and the task card <ID> in §6.
2. Read ONLY the spec sections listed in the card.
3. Implement exactly the card's Steps. Touch only the card's Files.
4. Run the card's Acceptance commands from opendot/ and paste their output.
5. Report: files changed, commands run + output, anything you could not do and why.
Do not commit. Do not edit PLAN.md.
```

### 0.5 Review Gate (Orchestrator, every task)

- [ ] `npm run typecheck && npm run lint && npm test` pass (paste output)
- [ ] Every Acceptance item on the card is demonstrably met
- [ ] Diff touches only the card's Files (plus lockfile if the card adds deps)
- [ ] No secrets, no `console.log` of payloads, no `any` without a `// reason:` comment
- [ ] UI tasks: screenshot via `npm run e2e -- --grep <ID>` (Playwright Electron) and eyeball against spec 10
- [ ] Shared contract changes (types/ipc) only in T02/T03 or by the orchestrator

---

## 1. Product in one page

**OpenDot** is a WhatsApp-style desktop app where every chat is a **Dot**, a specialised
AI agent with its own personality, model, tools and permissions.

- **Left:** list of Dots (avatar, name, last message, time, unread badge, live status such as
  "thinking…" or "using Gmail…"). A "+" button creates a new Dot.
- **Center:** the chat with the selected Dot: streaming bubbles, collapsible tool-call
  chips, inline approval cards, markdown and code.
- **Right drawer (toggle):** "Dot Info" for customising personality, model, tools,
  permissions, PII mode and links to other Dots.
- **Nav rail (far left):** Chats · Dot Links · Connections · Settings.
- **Settings → Models:** cloud providers (API key), self-hosted (Ollama, LM Studio, vLLM,
  llama.cpp) and any custom OpenAI- or Anthropic-compatible URL.
- **Connections:** unlimited MCP servers (stdio, HTTP, OAuth), Google Workspace, Microsoft 365
  and macOS capabilities (Files, Shell, Calendar, Reminders, Contacts, Notes, Screen,
  Clipboard, Notifications, Open apps/URLs).
- **Dot Links:** Dots can message each other, **RBAC-gated** by who can talk to whom,
  when (schedule windows), how often (rate limit), and whether each message needs the user's
  approval.
- **PII shield:** PII is detected locally and replaced with tokens (`⟦EMAIL_1⟧`) before any
  **cloud** model sees it. Real values are restored for display and for tool execution.
- **Create from a prompt:** the user writes what a Dot should do and picks its connectors; OpenDot generates the Dot's
  identity and personality from both (templates are just example prompts).
- **Local & persistent:** everything (settings, Dots, chat sessions, memory, logs) lives in `~/.opendot/` as JSON/JSONL files on
  the user's Mac. Sessions resume after restart; each Dot has long-term memory plus a shared "About me".
- **Personality:** every Dot has a persona (tone, verbosity, emoji, formality, quirks)
  generated from its use case and fully editable.
- **Always on (24/7):** while OpenDot runs (even with the window closed, living in the menu bar), always-on
  Dots watch their sources (Gmail, Outlook, calendars, Drive/OneDrive, Teams, folders, URLs, RSS, MCP
  resources, a local webhook, schedules) and react within seconds of new data. They post only what
  matters (`[URGENT]` / `[UPDATE]` / quiet) and respect budgets and quiet hours.
- **SuperBot:** a built-in, always-pinned "Super" Dot that knows what every Dot does, what it watches and what
  it currently knows. Ask it anything: it asks the relevant Dots in parallel and streams their answers live, then
  streams a combined answer with `[Inbox]`-style attributions.
- **Streaming everywhere:** every reply, including background, Dot-to-Dot and Super fan-out, appears token by token from the first token.

Glossary: **Dot** = configured agent plus its conversation. **Dot Link** = an RBAC rule
that lets Dot A message Dot B. **Connection** = an installed integration (an MCP server, a
native connector, or a macOS capability). **Grant** = a Dot's permission to use a Connection.

---

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Electron 44** + electron-vite 5 + Vite 7 + React 19 + TypeScript 5.9 | pi is a Node ≥22.19 ESM SDK and runs **in-process** in Electron's main process. No sidecar. |
| D2 | Lives in **`opendot/`** in this repo, as a standalone npm project (own `package.json`, not a workspace) | User decision. Isolated from other projects in the repo. |
| D3 | **pi SDK in-process**: one `AgentSession` per Dot, created lazily, disposed after 15 min idle | Uses pi's sessions, compaction, MCP, extension hooks, providers. |
| D4 | **No native node modules.** Storage = JSON files (atomic writes) + pi's own JSONL sessions | Avoids electron-rebuild failures. The data is small. |
| D5 | Secrets via Electron **`safeStorage`** (Keychain-backed), injected into pi with `ModelRuntime.setRuntimeApiKey` | Keys never touch disk in plaintext. |
| D6 | **PII: redact before cloud.** Default `auto` = on for non-local providers, off for localhost | User decision. Implemented as a pi extension (`context` + `tool_call` + `message_end` hooks). |
| D7 | **Unsigned (ad-hoc signed) DMG**, arm64 + x64, via electron-builder. Notarization is a disabled CI step | No Apple Developer account yet. |
| D8 | UI: Tailwind v4 (tokens via CSS variables) + Radix primitives + `motion` + lucide icons; Zustand state | Predictable for Haiku/Sonnet, accessible primitives. |
| D9 | Dot-to-Dot messaging = a pi tool `message_dot`, gated by an RBAC policy engine in main | Pi has no built-in sub-agents. We build ours on the SDK. |
| D10 | Google and Microsoft = **native connectors** (REST + OAuth PKCE loopback) with **bring-your-own OAuth client ID**. Everything else = MCP | No dependency on unverified third-party MCP packages for the core stacks. |
| D12 | **Always-on runtime** in the main process: WatcherService → EventRouter → DotSupervisor. Events enter the Dot's **main pi session** as custom messages (`sendCustomMessage`, `deliverAs: "followUp"`). The app lives in the menu bar when the window is closed | One brain per Dot with full continuity; no extra process. Polling with change cursors where push needs a public endpoint (spec 12). |
| D13 | **SuperBot** = a built-in Dot of kind `super` that routes via a live directory (prompt section) and the `ask_dots` parallel fan-out tool over LinkBus | Reuses Dot Links RBAC, approvals and streaming. No special-case runtime. |
| D14 | **Streaming protocol**: token-level `message-delta` (seq) + 1 s snapshots, first delta sent immediately, then coalesced per frame; PII-safe and tag-safe holdback | Lowest time-to-first-token without losing correctness (spec 14). |
| D11 | Package manager **npm**, lint/format **Biome**, tests **Vitest** (unit) + **Playwright Electron** (e2e) | Matches pi's own tooling. |

---

## 3. Architecture at a glance

```
┌────────────────────────── Electron main process (Node 22+, ESM) ───────────────────────────┐
│                                                                                            │
│  AppServices (src/main/services.ts) — composition root, created once                       │
│   ├─ Store            JSON repo: dots, links, connections, settings, audit (data/*.json)   │
│   ├─ SecretStore      safeStorage-encrypted secrets.bin                                    │
│   ├─ ModelService     one pi ModelRuntime; registers custom/self-hosted providers          │
│   ├─ ConnectionService  catalog + installed connections → MCP configs / native tools       │
│   ├─ PolicyEngine     tool permissions (allow/ask/deny) + Dot-Link RBAC                    │
│   ├─ ApprovalBroker   pending approvals ⇄ renderer (promise per request)                   │
│   ├─ PiiService       detect / tokenize / restore; per-session vaults                     │
│   ├─ DotRuntime       Map<dotId, DotHost>; DotHost wraps one pi AgentSession + StreamEmitter│
│   │     └─ per-session inline extensions: opendot-pii, opendot-policy, opendot-links,     │
│   │        opendot-native-tools, pi createMcpExtension(loadConfig=Dot's grants)            │
│   ├─ LinkBus          routes message_dot / ask_dots between DotHosts (RBAC, hops, streaming) │
│   ├─ WatcherService   sources (poll w/ cursors, push), scheduler, dedupe, backoff          │
│   ├─ EventRouter      batching, budgets, quiet hours → DotHost.deliverEvents()             │
│   ├─ DotSupervisor    keeps always-on Dots warm, restarts with backoff, health             │
│   ├─ Directory        DotProfiles + knowledge summaries for SuperBot                       │
│   └─ Background       tray (menu bar), hide-on-close, login item, power/network monitors   │
│                                                                                            │
│  ipc/handlers.ts — ipcMain.handle for every channel in shared/ipc.ts; pushes events        │
└───────────────▲─────────────────────────────────────────────────────▲──────────────────────┘
                │ contextBridge (preload/index.ts → window.opendot)     │ webContents.send(events)
┌───────────────┴────────────────────── Renderer (React 19) ───────────┴─────────────────────┐
│  design-system/ (tokens.css, components)   features/ (chats, dot-info, links, connections, │
│  settings, onboarding, new-dot)   stores/ (Zustand, fed by window.opendot.on(...))          │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Data flow for one user message: Composer → `dots.send(dotId, text)` → `DotHost.prompt()`
→ pi agent loop → the `context` hook redacts PII (cloud only) → provider stream →
`message_update` events → DotHost maps them to `ChatEvent`s (restoring PII tokens) →
`webContents.send('dot:event')` → chat store → bubbles. Tool calls pass through the
`tool_call` hook: PII restore into args, then the PolicyEngine (allow/ask/deny), with
ApprovalBroker showing an inline approval card when the decision is "ask".

---

## 4. Spec index

| File | Contents |
|---|---|
| `docs/spec/01-scaffold.md` | Folder tree, pinned dependencies, every config file verbatim, npm scripts |
| `docs/spec/02-data-and-ipc.md` | `shared/types.ts` (all domain types), storage layout, IPC channels + preload API |
| `docs/spec/03-pi-runtime.md` | DotHost / DotRuntime, session creation, event mapping, lifecycle, system prompt assembly |
| `docs/spec/04-models.md` | Provider kinds (cloud / self-hosted / custom URL), registration in pi, model discovery, test connection |
| `docs/spec/05-connections.md` | Connection model, MCP (unlimited), catalog, Google, Microsoft, macOS capabilities, OAuth |
| `docs/spec/06-security-pii.md` | SecretStore, tool PolicyEngine, approvals, PII detection + vault + hooks, audit log |
| `docs/spec/07-dot-links.md` | Dot-to-Dot messaging, RBAC policy model, LinkBus, loop prevention, UI |
| `docs/spec/08-personality.md` | Dot schema, persona model, templates, "describe a Dot" generator, customisation limits |
| `docs/spec/09-design-system.md` | Tokens (color, type, space, radius, shadow, motion), themes, component specs |
| `docs/spec/10-screens.md` | Pixel-level layout of every screen and state, plus copy |
| `docs/spec/11-quality-release.md` | Testing strategy, fixtures, fake provider, e2e, soak test, packaging, CI, release |
| `docs/spec/12-always-on.md` | 24/7 Dots: background lifecycle, watchers & sources, event pipeline, budgets, response protocol, UI |
| `docs/spec/13-superbot.md` | SuperBot: directory, knowledge summaries, `ask_dots` / `get_dot_updates` / `search_dot_history`, @mentions, fan-out streaming, RBAC |
| `docs/spec/14-streaming.md` | Streaming contract, StreamEmitter, PII/tag holdback, renderer StreamingMarkdown, latency budgets and tests |

---

## 5. Milestones

| Milestone | Outcome | Tasks |
|---|---|---|
| **M0 Foundation** | App boots to an empty WhatsApp-style shell; design system gallery | T01–T10 |
| **M1 Talk to a Dot** | Create a Dot, choose a model, chat with token-level streaming, persisted history | T11–T20, T55, T56 |
| **M2 Tools** | MCP (unlimited), macOS capabilities, tool permissions + approvals | T21–T29 |
| **M3 Stacks** | Google Workspace + Microsoft 365 native connectors | T30–T33 |
| **M4 Safety & Society** | PII shield, Dot Links with RBAC, audit log | T34–T40 |
| **M4b Always on** | Menu-bar background app, watchers, realtime events, budgets, Activity screen | T54, T57–T64 |
| **M5b SuperBot** | Directory, knowledge summaries, fan-out with live streaming, briefings | T65–T67 |
| **M5 Personality** | Personas, templates, "describe a Dot" wizard, customisation drawer | T41–T45 |
| **M6 Ship** | Onboarding, settings screens, polish, e2e + soak, DMG build, GitHub Release CI, docs | T46–T53, T68 |

---

## 6. Task board

Legend: **S** = Sonnet, **H** = Haiku. "Spec" = sections to read. All paths are relative to `opendot/`.
Acceptance always includes `npm run typecheck && npm run lint && npm test` (abbreviated **✅green**).

### M0 — Foundation

#### T01 · Scaffold the Electron + Vite + React project — **S** — deps: none — Status: done
- **Spec:** 01 (all)
- **Files:** `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `biome.json`, `electron-builder.yml`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `build/entitlements.mac.plist`, `scripts/check-node-version.mjs`, `README.md`
- **Steps:** Create every file in spec 01 §2–§5 verbatim. Run `npm install`. Run `scripts/check-node-version.mjs`, which asserts Electron's bundled Node is ≥ 22.19. If it fails, bump Electron to the newest major that passes and record it in spec 01 §3.
- **Acceptance:** `npm run dev` opens a window titled "OpenDot" showing "Hello OpenDot" (in headless CI: `npm run build` succeeds). `node scripts/check-node-version.mjs` prints `ok`. ✅green (an empty test suite passes via `passWithNoTests`).

#### T02 · Shared domain types — **S** — deps: T01 — Status: done
- **Spec:** 02 §1 and §1.1
- **Files:** `src/shared/types.ts`, `src/shared/defaults.ts`, `src/shared/ids.ts`
- **Steps:** Copy the types from spec 02 §1 exactly. Implement `defaults.ts` (default settings, default persona, default policy) and `ids.ts` (`newId(prefix)` using nanoid, prefixes `dot_`, `msg_`, `lnk_`, `con_`, `apr_`, `aud_`).
- **Acceptance:** ✅green. `src/shared/types.test.ts` asserts `defaultSettings()` satisfies `AppSettings` and `newId('dot')` matches `/^dot_[A-Za-z0-9_-]{12}$/`.

#### T03 · IPC contract + preload bridge — **S** — deps: T02 — Status: done
- **Spec:** 02 §3
- **Files:** `src/shared/ipc.ts`, `src/preload/index.ts`, `src/renderer/src/env.d.ts`, `src/main/ipc/register.ts`
- **Steps:** Define the `OpenDotApi` interface and `Channels` map from spec 02 §3, **including the §1.1 additions** (watchers, events, runtime, superbot, new event channels). In the preload, expose `window.opendot` via `contextBridge`, typed exactly as `OpenDotApi`. `register.ts` exports `registerIpc(handlers: IpcHandlers)`, which wires every invoke channel and validates arguments with the zod schemas from spec 02 §3.4.
- **Acceptance:** ✅green. Unit test: calling a registered handler with invalid args rejects with `IpcValidationError`.

#### T04 · Storage layer (JSON repo + atomic writes) — **S** — deps: T02 — Status: done
- **Spec:** 02 §2
- **Files:** `src/main/store/json-file.ts`, `src/main/store/store.ts`, `src/main/store/store.test.ts`, `src/main/paths.ts`
- **Steps:** `paths.ts` resolves `~/.opendot` (spec 02 §2), overridable with the `OPENDOT_DATA_DIR` env var (for tests). `JsonFile<T>` provides an atomic read/write with zod validation, a schema `version` and a `migrate` hook. `Store` exposes typed collections `dots`, `links`, `connections`, `settings`, plus `audit` (append-only JSONL with rotation at 5 MB). It serialises writes per file with a promise queue.
- **Acceptance:** ✅green. Tests: concurrent writes don't corrupt; a corrupt file is moved to `*.corrupt-<ts>` and defaults are loaded; audit rotation works.

#### T05 · Design tokens → CSS — **H** — deps: T01 — Status: done
- **Spec:** 09 §1–§3
- **Files:** `src/renderer/src/design-system/tokens.css`, `src/renderer/src/design-system/theme.ts`, `src/renderer/src/styles.css`
- **Steps:** Write every token from spec 09 §1 as CSS custom properties for `:root` (light) and `[data-theme="dark"]`. Map them in `styles.css` with the Tailwind v4 `@theme inline` block exactly as in spec 09 §2. `theme.ts` exports `applyTheme(mode: 'light'|'dark'|'system')`, which sets `data-theme` on `<html>` and listens to `matchMedia` for `system`.
- **Acceptance:** ✅green. `grep -rE "#[0-9a-fA-F]{3,8}" src/renderer/src --include=*.tsx` returns nothing.

#### T06 · Primitive components (batch A) — **H** — deps: T05 — Status: done
- **Spec:** 09 §4.1–§4.8
- **Files:** `src/renderer/src/design-system/components/{Button,IconButton,Input,TextArea,Switch,Badge,Avatar,Tooltip}.tsx`, `.../components/index.ts`
- **Steps:** Implement each component exactly per its spec table (variants, sizes, states, a11y). Use `cva` for variants and Radix for Switch and Tooltip.
- **Acceptance:** ✅green. `components.test.tsx` renders each variant and checks roles and aria attributes from the spec.

#### T07 · Primitive components (batch B) — **H** — deps: T05 — Status: done
- **Spec:** 09 §4.9–§4.16
- **Files:** `.../components/{Dialog,Sheet,DropdownMenu,Select,Slider,Tabs,ScrollArea,Toast,EmptyState,Spinner,Kbd,SegmentedControl}.tsx` (add exports to `index.ts`)
- **Acceptance:** ✅green, plus a11y tests per spec (focus trap in Dialog, Esc closes Sheet).

#### T08 · Design-system gallery screen — **H** — deps: T06, T07 — Status: done
- **Spec:** 09 §5
- **Files:** `src/renderer/src/features/gallery/Gallery.tsx`, route registration in `App.tsx`, `test/e2e/helpers.ts` (spec 11 §3.1), `test/e2e/T08.spec.ts`
- **Steps:** A dev-only route (`#/gallery`, enabled when `import.meta.env.DEV`) that renders every component in every variant, in light and dark side by side.
- **Acceptance:** `npm run e2e -- --grep T08` captures `gallery-light.png` and `gallery-dark.png` with no console errors.

#### T09 · App shell layout (WhatsApp frame) — **S** — deps: T06, T07 — Status: done
- **Spec:** 10 §1, §2
- **Files:** `src/renderer/src/app/{AppShell,NavRail,ListPane,MainPane,RightDrawer}.tsx`, `src/renderer/src/app/router.ts`, `src/renderer/src/stores/ui.ts`, `App.tsx`
- **Steps:** Build the 4-region layout (nav rail 64px · list pane 360px resizable 300–480 · main · right drawer 380px), the hash router (`#/chats/:dotId?`, `#/links`, `#/connections`, `#/settings/:section?`), keyboard shortcuts from spec 10 §2.4, and the macOS `titleBarStyle: 'hiddenInset'` drag regions.
- **Acceptance:** e2e `T09` navigates every route and screenshots it. The window is usable at its minimum size of 900×600.

#### T10 · Main-process composition root + window — **S** — deps: T03, T04 — Status: done
- **Spec:** 01 §6, 02 §3.3
- **Files:** `src/main/index.ts`, `src/main/services.ts`, `src/main/window.ts`, `src/main/ipc/handlers/*.ts` (stubs; `app.*` implemented here), `src/main/log.ts`
- **Steps:** Single-instance lock, BrowserWindow with the secure prefs from spec 01 §6 (contextIsolation, sandbox, no nodeIntegration, CSP), `fix-path` on startup, electron-log, and `AppServices` built in dependency order. Every IPC handler is registered and returns `NotImplemented` until its task fills it in.
- **Acceptance:** ✅green. The app boots and `window.opendot.app.info()` returns the version and data dir. A second launch focuses the first window.

### M1 — Talk to a Dot

#### T11 · SecretStore — **S** — deps: T10 — Status: done
- **Spec:** 06 §2
- **Files:** `src/main/security/secret-store.ts`, `.test.ts`
- **Acceptance:** Round-trips secrets. Falls back to a refused state (not plaintext) when `safeStorage.isEncryptionAvailable()` is false. Tests mock `safeStorage`. ✅green.

#### T12 · ModelService (providers, discovery, test connection) — **S** — deps: T11 — Status: done
- **Spec:** 04 (all), 03 §2
- **Files:** `src/main/models/model-service.ts`, `src/main/models/provider-presets.ts`, `src/main/models/discovery.ts`, `src/main/ipc/handlers/models.ts`, tests
- **Acceptance:** Unit tests with a mocked `fetch`: Ollama `/api/tags` discovery, OpenAI-compatible `/v1/models` discovery, `testConnection` failure messages. `models.list()` returns cloud models only when a key is set. ✅green.

#### T13 · Fake provider for tests — **S** — deps: T12 — Status: done
- **Files:** `src/main/models/fake-provider.ts`, `test/fixtures/fake-scripts/*.json`
- **Steps:** Wrap pi-ai's built-in `fauxProvider` as provider `opendot-fake` (enabled only when `OPENDOT_FAKE_PROVIDER=1`), exactly per spec 04 §6. It replays scripted assistant turns (text, thinking, tool calls) from JSON fixtures, and the `$capture` step records what the model would have received. The e2e tests and every M1+ test use it.
- **Spec:** 04 §6, 11 §2
- **Acceptance:** A unit test drives a pi `AgentSession` using the fake provider and receives a scripted text and tool call. ✅green.

#### T14 · DotHost + DotRuntime (pi sessions) — **S** — deps: T12, T13 — Status: done
- **Spec:** 03 (all), 14 §1
- **Files:** `src/main/runtime/dot-host.ts`, `src/main/runtime/dot-runtime.ts`, `src/main/runtime/system-prompt.ts`, `src/main/runtime/event-mapper.ts`, tests
- **Acceptance:** Tests with the fake provider: prompt → ChatEvents in the order of spec 03 §5. Steer and follow-up while streaming. Abort. Idle disposal after a timeout (fake timers). History reload from JSONL after a "restart" (new runtime, same dir). ✅green.

#### T55 · StreamEmitter (token-level streaming, PII/tag-safe) — **S** — deps: T14 — Status: done
- **Spec:** 14 §1–§2, §5 (unit part)
- **Files:** `src/main/runtime/stream-emitter.ts`, `.test.ts`, wire it into `src/main/runtime/event-mapper.ts`
- **Acceptance:** Every unit case in spec 14 §5 passes with fake timers (immediate first delta, ≤ 1 emit/16 ms after, snapshots, seq monotonic, token split across deltas restored correctly, NO_UPDATE suppression, [URGENT] stripping, tool-call `preparing` chip on `toolcall_start`). ✅green.

#### T15 · Dots CRUD + chat IPC — **S** — deps: T14 — Status: done
- **Spec:** 02 §3 (dots.*, chat.*), 03 §6
- **Files:** `src/main/ipc/handlers/dots.ts`, `src/main/ipc/handlers/chat.ts`, `src/main/ipc/handlers/settings.ts`, `src/main/dots/dot-service.ts`, tests
- **Acceptance:** Create, update, duplicate, delete and list Dots. `settings.get/update` work and broadcast `settings:changed`. `chat.history` returns paged `ChatMessageView[]` with the synthetic greeting first. Deleting a Dot disposes its host and removes its session dir. ✅green.

#### T16 · Renderer stores + event subscription — **S** — deps: T15, T09, T55 — Status: done
- **Spec:** 02 §3.5, 10 §3, 14 §4
- **Files:** `src/renderer/src/stores/{dots,chat,settings,approvals}.ts`, `src/renderer/src/lib/api.ts`
- **Acceptance:** Store unit tests apply a ChatEvent sequence and produce the expected `ChatMessageView[]`, including deltas, a seq gap healed by a snapshot, duplicate/old seq ignored, the tool chip lifecycle (preparing → running → done), and `peer-stream` rows. Only the streaming message object changes identity per update. ✅green.

#### T17 · Dot list pane — **H** — deps: T16 — Status: done
- **Spec:** 10 §3.1, 09 §4.17 (DotListItem)
- **Files:** `src/renderer/src/features/chats/{DotList,DotListItem,DotSearch}.tsx`
- **Acceptance:** e2e `T17` shows 3 seeded Dots sorted by last activity, live search filtering, the unread badge, and the "thinking…" status. ✅green.

#### T18 · Chat view: bubbles, markdown, streaming, tool chips — **S** — deps: T16 — Status: done
- **Spec:** 10 §3.2, 09 §4.18–§4.22
- **Files:** `src/renderer/src/features/chats/{ChatView,ChatHeader,MessageList,MessageBubble,ToolCallChip,DaySeparator,TypingIndicator,Markdown}.tsx`
- **Acceptance:** e2e `T18` with the fake provider: send → user bubble → typing dots → streamed assistant bubble → tool chip expands to show args/result. Code blocks are highlighted. Auto-scroll stays at the bottom unless the user scrolled up ("↓ New messages" pill). ✅green.

#### T56 · StreamingMarkdown + first-token UX — **S** — deps: T18 — Status: done
- **Spec:** 14 §4, §5 (e2e part)
- **Files:** `src/renderer/src/features/chats/StreamingMarkdown.tsx`, update `MessageBubble.tsx`, `TypingIndicator.tsx`, `test/e2e/T56.spec.ts`
- **Acceptance:** e2e `T56` with `stream-long`: first paint ≤ 50 ms after `firstTokenAt`, the final text matches exactly, ≥ 50 fps, no layout jump from the typing indicator to the bubble, the streaming dot shows and disappears. ✅green.

#### T19 · Composer — **H** — deps: T18 — Status: done
- **Spec:** 10 §3.3, 09 §4.23
- **Files:** `src/renderer/src/features/chats/Composer.tsx`
- **Acceptance:** Enter sends and Shift+Enter adds a newline. Textarea auto-grows to 8 lines. While streaming, the send button becomes ⏹ stop and Enter queues a follow-up (with the "will send after reply" hint). Drafts persist per Dot in memory. ✅green.

#### T20 · Settings → Models screen — **S** — deps: T12, T09 — Status: done
- **Spec:** 10 §6.1, 04 §5
- **Files:** `src/renderer/src/features/settings/{SettingsLayout,ModelsSettings,ProviderCard,AddProviderDialog,DefaultModelPicker}.tsx`
- **Acceptance:** e2e `T20`: add an Ollama provider with a mocked URL → discover models → set default → create a Dot → chat (fake). API key fields are masked and never re-displayed after save (only "••••1234"). ✅green.

### M2 — Tools

#### T21 · Connection model + ConnectionService — **S** — deps: T15 — Status: done
- **Spec:** 05 §1–§2
- **Files:** `src/main/connections/{connection-service,catalog}.ts`, `src/main/ipc/handlers/connections.ts`, tests
- **Acceptance:** Install, uninstall, enable and disable a connection. `grantsForDot(dotId)` resolves to concrete MCP server configs and native tool sets. ✅green.

#### T22 · MCP integration per Dot — **S** — deps: T21, T14 — Status: done
- **Spec:** 05 §3, 03 §4
- **Files:** `src/main/runtime/extensions/mcp.ts`, `src/main/connections/mcp-status.ts`, tests
- **Steps:** Use pi's `createMcpExtension({ loadConfig, credentials, logPath, openUrl })` with `loadConfig` returning only the Dot's granted MCP servers. Add the codemode and tool-search extensions. Expose connection status (connected, needs-auth, error with stderr tail) to the UI.
- **Acceptance:** An integration test spawns `test/fixtures/mcp-echo-server.mjs`, a hand-written minimal JSON-RPC stdio MCP server (no SDK dependency) given verbatim in spec 05 §3.5. The Dot calls `mcp__echo__echo` via a fake provider script. ✅green.

#### T23 · MCP catalog JSON — **H** — deps: T21 — Status: done
- **Spec:** 05 §2.3
- **Files:** `src/main/connections/catalog/*.json`, `catalog.test.ts`
- **Steps:** Write the catalog entries listed in spec 05 §2.3 exactly. The test validates every entry against the `CatalogEntry` zod schema.
- **Acceptance:** ✅green.

#### T24 · Connections screen — **S** — deps: T21, T23, T09 — Status: done
- **Spec:** 10 §5, 05 §2.4
- **Files:** `src/renderer/src/features/connections/{ConnectionsScreen,ConnectionCard,CatalogGrid,AddMcpDialog,ConnectionDetail,EnvEditor}.tsx`
- **Acceptance:** e2e `T24`: add a custom stdio MCP (echo fixture) → status "Connected · 1 tool" → detail lists tools with exposure selectors. Paste-JSON import (Claude Desktop/Cursor `mcpServers` format) works for N servers at once. ✅green.

#### T25 · Tool PolicyEngine + ApprovalBroker — **S** — deps: T14 — Status: done
- **Spec:** 06 §3–§4
- **Files:** `src/main/security/{policy-engine,approval-broker}.ts`, `src/main/runtime/extensions/policy.ts`, `src/main/ipc/handlers/approvals.ts`, tests
- **Acceptance:** Tests cover allow, deny and ask (approve, reject, timeout → reject), plus "always allow for this Dot" persisting a rule. Annotation defaults: readOnly → allow, destructive → ask. Blocked calls return the reason to the model. ✅green.

#### T26 · Inline approval card + approvals tray — **H** — deps: T25, T18 — Status: done
- **Spec:** 10 §3.4, 09 §4.24
- **Files:** `src/renderer/src/features/chats/ApprovalCard.tsx`, `src/renderer/src/app/ApprovalsTray.tsx`
- **Acceptance:** e2e `T26`: the fake script calls a destructive tool → card shows tool, args (PII restored), Allow once / Always / Deny → the result continues. ✅green.

#### T27 · macOS capabilities (native tools) — **S** — deps: T25 — Status: done
- **Spec:** 05 §6
- **Files:** `src/main/connections/mac/{index,files,shell,calendar,reminders,contacts,notes,screen,clipboard,notify,open}.ts`, `src/main/connections/mac/permissions.ts`, `src/main/runtime/extensions/native-tools.ts` (mac part), the mac methods in `src/main/ipc/handlers/connections.ts`, tests
- **Acceptance:** Tests mock `execFile('osascript')` and Electron APIs. Every tool has a TypeBox schema, annotations and a description. Permission status maps to `granted|denied|not-determined|restricted`. ✅green.

#### T28 · Mac permissions panel — **H** — deps: T27, T24 — Status: done
- **Spec:** 10 §5.3
- **Files:** `src/renderer/src/features/connections/MacPermissions.tsx`
- **Acceptance:** Each capability shows its status pill and an "Open System Settings" button (deep links from spec 05 §6.3). ✅green.

#### T29 · Per-Dot tool grants UI — **S** — deps: T24, T25 — Status: done
- **Spec:** 10 §4.4
- **Files:** `src/renderer/src/features/dot-info/ToolsSection.tsx`
- **Acceptance:** Toggle connection grants per Dot. Per-tool allow/ask/deny overrides. Changes apply on the next turn (DotHost reloads extensions, spec 03 §7). ✅green.

### M3 — Stacks

#### T30 · OAuth loopback (PKCE) helper — **S** — deps: T11 — Status: done
- **Spec:** 05 §4
- **Files:** `src/main/oauth/{loopback,pkce,token-store}.ts`, tests
- **Acceptance:** Tests: PKCE verifier/challenge per RFC 7636 test vector, state mismatch rejected, refresh-before-expiry, tokens stored only in SecretStore. ✅green.

#### T31 · Google Workspace connector — **S** — deps: T30, T25 — Status: done
- **Spec:** 05 §5.1
- **Files:** `src/main/connections/google/{index,gmail,calendar,drive,client}.ts`, the google branch of `connection-service.ts` `signIn`/`signOut` and of `native-tools.ts`, tests
- **Acceptance:** Tools listed in spec 05 §5.1 with schemas. Tests mock `fetch` against recorded response shapes. Scopes are requested incrementally per enabled sub-service. ✅green.

#### T32 · Microsoft 365 connector — **S** — deps: T30, T25 — Status: done
- **Spec:** 05 §5.2
- **Files:** `src/main/connections/microsoft/{index,mail,calendar,onedrive,teams,client}.ts`, the microsoft branch of `connection-service.ts` `signIn`/`signOut` and of `native-tools.ts`, tests
- **Acceptance:** Same as T31, against Microsoft Graph v1.0. ✅green.

#### T33 · Stack setup wizards — **H** — deps: T31, T32, T24 — Status: done
- **Spec:** 10 §5.4, 05 §5.3
- **Files:** `src/renderer/src/features/connections/{GoogleSetup,MicrosoftSetup}.tsx`
- **Acceptance:** Step-by-step BYO client-ID instructions (copy from spec 05 §5.3), paste fields, "Sign in" opens the browser, success shows the account email. ✅green.

### M4 — Safety & Society

#### T34 · PII detectors — **S** — deps: T02 — Status: done
- **Spec:** 06 §5.1–§5.2
- **Files:** `src/main/pii/detectors.ts`, `src/main/pii/detectors.test.ts`
- **Acceptance:** Every positive and negative case in spec 06 §5.7 passes (emails, phones (libphonenumber), cards (Luhn), IBAN (mod-97), SSN, IPv4/6, API keys/JWT/AWS, custom terms, names via `compromise` when enabled). Overlap resolution: longest span wins. ✅green.

#### T35 · PII vault + tokenize/restore — **S** — deps: T34, T11 — Status: done
- **Spec:** 06 §5.3–§5.4
- **Files:** `src/main/pii/{vault,pii-service}.ts`, `src/main/ipc/handlers/pii.ts`, tests
- **Acceptance:** Deterministic tokens per session (`⟦EMAIL_1⟧`). Restore is idempotent. The vault is persisted encrypted per session and deleted with the session. Deep restore works on nested tool args. ✅green.

#### T36 · PII pi extension + UI indicator — **S** — deps: T35, T14 — Status: done
- **Spec:** 06 §5.5–§5.6, 10 §3.5
- **Files:** `src/main/runtime/extensions/pii.ts`, `src/renderer/src/features/chats/PiiBadge.tsx`, `src/renderer/src/features/settings/PrivacySettings.tsx` (spec 10 §6.3), tests
- **Acceptance:** Integration test with the fake provider and a capturing stream: the provider request contains tokens, never raw values. Tool args reaching `execute` contain raw values. The UI shows raw values plus a 🛡 "3 items protected" badge with a hover list (types only, no values). Local-provider Dots in `auto` mode are not redacted. ✅green.

#### T37 · Dot-Link policy engine (RBAC) — **S** — deps: T25 — Status: done
- **Spec:** 07 §2–§3
- **Files:** `src/main/links/{link-policy,schedule}.ts`, tests
- **Acceptance:** Every case in the spec 07 §3.4 decision table passes, including schedule windows across midnight and time zones, rate limits and default deny. ✅green.

#### T38 · LinkBus + `list_dots` / `message_dot` tools — **S** — deps: T37, T14 — Status: done
- **Spec:** 07 §4–§5
- **Files:** `src/main/links/link-bus.ts`, `src/main/runtime/extensions/links.ts`, `src/main/ipc/handlers/links.ts`, `chat.linkHistory` in `src/main/ipc/handlers/chat.ts`, tests
- **Acceptance:** A→B request/reply works. Cycle A→B→A is rejected. Max depth 3. Timeout. "ask" mode creates an approval. The transcript of B's side is stored in its "link inbox" session. The audit log records each hop. ✅green.

#### T39 · Dot Links screen (graph + rules) — **S** — deps: T38, T09 — Status: done
- **Spec:** 10 §7, 07 §6
- **Files:** `src/renderer/src/features/links/{LinksScreen,LinkGraph,LinkRuleEditor,LinkActivity}.tsx`
- **Acceptance:** e2e `T39`: create rule A→B (ask, weekdays 9–18, 10/h) → the graph edge appears → activity log shows a test exchange. ✅green.

#### T40 · Audit log viewer — **H** — deps: T38, T25, T36 — Status: done
- **Spec:** 06 §6, 10 §6.5
- **Files:** `src/renderer/src/features/settings/AuditLog.tsx`, `src/main/ipc/handlers/audit.ts`
- **Acceptance:** Filter by Dot, type and date. Export JSONL. Never displays PII values or secrets. ✅green.

### M5 — Personality & memory

#### T69 · Persistent memory (Dot + About me) — **S** — deps: T41 — Status: done
- **Spec:** 02 §2.1
- **Files:** `src/main/memory/memory-service.ts`, `src/main/runtime/extensions/memory.ts`, `src/main/ipc/handlers/memory.ts`, `src/renderer/src/features/dot-info/MemorySection.tsx`, `src/renderer/src/features/settings/AboutMeSettings.tsx`, tests
- **Acceptance:** `remember`/`forget`/`recall` tools work (fake provider), memory survives an app restart (it is in `~/.opendot/dots/<id>/memory.json` and `~/.opendot/memory.json`), the prompt sections respect the size limits, UI edit/pin/delete. ✅green.

#### T41 · Persona model + system prompt compiler — **S** — deps: T14 — Status: done
- **Spec:** 08 §1–§3
- **Files:** `src/main/dots/persona.ts`, update `src/main/runtime/system-prompt.ts`, tests
- **Acceptance:** Snapshot tests of compiled prompts for 3 personas. Persona changes trigger a prompt delta on the next turn. ✅green.

#### T42 · Dot templates — **H** — deps: T41 — Status: done
- **Spec:** 08 §4, 12 §6, 13 §4 (super.json persona)
- **Files:** `src/main/dots/templates/*.json`, `templates.test.ts`
- **Acceptance:** All 10 templates from spec 08 §4 plus `super.json` validate against `DotTemplate`, including `alwaysOn` and `suggestedWatchers` from spec 12 §6. ✅green.

#### T43 · Dot generator: prompt + connectors → identity & personality — **S** — deps: T41, T12, T21 — Status: done
- **Spec:** 08 §5
- **Files:** `src/main/dots/dot-architect.ts`, tests
- **Acceptance:** Per spec 08 §5: streams via `streamSimple` (`dots:draft-stream`), strict JSON validated by zod with 1 repair retry, connectors shape the persona + watchers, `connectorChoices()` lists installed + available connectors, deterministic fallback without a model. Tests with the fake provider. ✅green.

#### T44 · New Dot flow — **S** — deps: T42, T43, T17 — Status: done
- **Spec:** 10 §4.1
- **Files:** `src/renderer/src/features/new-dot/{NewDotDialog,TemplatePicker,DescribeStep,ReviewStep}.tsx`
- **Acceptance:** e2e `T44`: write a prompt, tick connectors (one installed, one not) → the streamed preview → Review → Create. The Dot has a grant for the installed one and a setup card for the other; template chips prefill the prompt + connectors. The new Dot opens with its greeting. ✅green.

#### T45 · Dot Info drawer (customisation) — **S** — deps: T41, T29 — Status: done
- **Spec:** 10 §4.2–§4.4, 08 §6
- **Files:** `src/renderer/src/features/dot-info/{DotInfoDrawer,IdentitySection,PersonaSection,ModelSection,PrivacySection,LinksSection,DangerZone}.tsx`
- **Acceptance:** e2e `T45` edits name, color, icon, tone sliders, model and PII mode. Changes persist and the header updates live. Customisation limits from spec 08 §6 are enforced. ✅green.

### M6 — Ship

#### T46 · Onboarding — **S** — deps: T20, T44 — Status: done
- **Spec:** 10 §8
- **Acceptance:** First launch: welcome → choose provider (cloud key / Ollama auto-detect / URL) → pick 3 starter Dots → land in chats. ✅green.

#### T47 · Notifications, dock badge, app menu — **H** — deps: T16 — Status: done
- **Spec:** 10 §9, 10 §6.4
- **Files:** `src/main/notifications.ts`, `src/main/menu.ts`, `src/renderer/src/features/settings/NotificationSettings.tsx`
- **Acceptance:** A reply in a background Dot shows a native notification (when enabled) and the dock badge shows total unread. ✅green.

#### T48 · Motion & polish pass — **S** — deps: T18, T45 — Status: done
- **Spec:** 09 §3 (motion), 10 §10 (polish checklist)
- **Acceptance:** Every item in spec 10 §10 checked, plus a reduced-motion check. ✅green.

#### T49 · E2E suite completion — **S** — deps: T46, T47, T48, T53, T68 — Status: done
- **Spec:** 11 §3
- **Acceptance:** `npm run e2e` passes headless on macOS CI, with the golden path from spec 11 §3.2. ✅green.

#### T50 · Packaging: DMG (ad-hoc signed) — **S** — deps: T49 — Status: done
- **Spec:** 11 §4
- **Acceptance:** `npm run dist:mac` produces `release/OpenDot-<ver>-arm64.dmg` and `-x64.dmg`. The packaged app launches, creates a Dot and chats with Ollama. `codesign -dv` shows an ad-hoc signature. The pi codemode worker and the photon wasm load from `app.asar.unpacked`. ✅green.

#### T51 · Release CI — **H** — deps: T50 — Status: done
- **Spec:** 11 §5
- **Files:** `.github/workflows/opendot-ci.yml`, `.github/workflows/opendot-release.yml` (repo root)
- **Acceptance:** CI runs typecheck, lint, test and e2e on PRs touching `opendot/**`. A tag `opendot-v*` builds and uploads DMGs to a GitHub Release. The notarize step is present but gated by `if: secrets.APPLE_ID != ''`.

#### T53 · Settings: General, Advanced, About — **H** — deps: T20 — Status: done
- **Spec:** 10 §6.2, §6.6, §6.7
- **Files:** `src/renderer/src/features/settings/{GeneralSettings,AdvancedSettings,AboutSettings}.tsx`, plus `app.setLoginItemSettings` and the "Reset OpenDot" handler in `src/main/ipc/handlers/app.ts`
- **Acceptance:** e2e `T53`: theme switch applies instantly and persists; accent swatch changes the accent token; Reset requires typing RESET and relaunches with empty data. ✅green.

#### T52 · Docs — **H** — deps: T50 — Status: done
- **Files:** `README.md`, `docs/USER_GUIDE.md`, `docs/CONTRIBUTING.md`, `docs/ARCHITECTURE.md`
- **Acceptance:** Install steps (including the right-click → Open / `xattr` note for unsigned builds), Google/Microsoft client-ID setup, adding MCP servers, privacy model.

### M4b — Always on (24/7)

#### T54 · Background lifecycle: menu bar, hide-on-close, login item, power & network — **S** — deps: T10, T47 — Status: done
- **Spec:** 12 §1, 10 §6 (Background section)
- **Files:** `src/main/background.ts`, `src/main/tray.ts`, `build/trayTemplate.png`, `build/trayTemplate@2x.png`, `src/renderer/src/features/settings/BackgroundSettings.tsx`, `src/main/window.ts` (close→hide)
- **Acceptance:** Closing the window hides it and the app keeps running. The tray menu matches spec 12 §1 and reflects health. ⌘Q confirms when always-on Dots exist. Launch at login starts hidden. suspend/resume triggers catch-up (unit test with an emitted `powerMonitor` mock). `keepAwake` toggles the powerSaveBlocker. ✅green.

#### T57 · Watcher model, scheduler, cursors, dedupe, backoff — **S** — deps: T15 — Status: done
- **Spec:** 12 §2.1, 02 §1.1
- **Files:** `src/main/watchers/{watcher-service,scheduler,dedupe,types}.ts`, `src/main/ipc/handlers/watchers.ts`, tests
- **Acceptance:** Fake-clock tests: intervals with jitter, ≤ 4 concurrent polls, exponential backoff up to 30 min, needs-auth stops retrying until a connection change, cursors persisted, first run emits nothing, dedupe across restarts, pause-all and Dot-off stop scheduling. ✅green.

#### T58 · EventRouter + event delivery + response protocol — **S** — deps: T57, T55, T47 — Status: done
- **Spec:** 12 §2.2–§2.3, §3; 06 §5.5 (custom messages)
- **Files:** `src/main/watchers/event-router.ts`, `src/main/usage.ts`, `DotHost.deliverEvents` in `src/main/runtime/dot-host.ts`, the `always_on` prompt section in `src/main/runtime/system-prompt.ts`, event mapping in `event-mapper.ts`, `src/main/notifications.ts` (importance rules), tests
- **Acceptance:** Integration test (fake provider): 3 events within 10 s → one batch → one turn; a high-importance event → immediate; `NO_UPDATE` → hidden + "handled", no unread; `[URGENT]` → notification even in quiet hours; a user message during an event turn steers; over budget → queued + a summary batch after reset; events reach the model PII-masked. ✅green.

#### T59 · DotSupervisor + runtime health + IPC — **S** — deps: T58 — Status: done
- **Spec:** 12 §2.4
- **Files:** `src/main/runtime/dot-supervisor.ts`, `src/main/ipc/handlers/runtime.ts`, `src/main/ipc/handlers/events.ts`, the idle-reaper exemption in `dot-runtime.ts`, tests
- **Acceptance:** Always-on Dots are warm on startup. A delivery failure → backoff schedule 5 s/30 s/2 min/10 min/30 min, then recovers. A config error → `error` + one notification, no retry until the config changes. `runtime:health` throttled to 1/s. ✅green.

#### T60 · Sources A: schedule, folder, url, rss, local-webhook — **S** — deps: T57 — Status: done
- **Spec:** 12 §4 (those rows)
- **Files:** `src/main/watchers/sources/{schedule,folder,url,rss,rss-parse,local-webhook}.ts`, `test/fixtures/sources/**`, tests
- **Acceptance:** Per-source tests from spec 12 §4 (first run, new items, dedupe, errors). Webhook: auth, 413, 429, binds only to 127.0.0.1. Schedule: catch-up ≤ 6 h after wake. ✅green.

#### T61 · Sources B: gmail, google-calendar, google-drive — **S** — deps: T57, T31 — Status: done
- **Spec:** 12 §4 (those rows), 05 §5.1
- **Files:** `src/main/watchers/sources/{gmail,google-calendar,google-drive}.ts`, fixtures, tests
- **Acceptance:** Recorded-fixture tests: historyId cursor, 404 history reset, metadata fetch, calendar syncToken + reminder-once, drive changes paging. ✅green.

#### T62 · Sources C: outlook-mail, outlook-calendar, onedrive, teams-chat — **S** — deps: T57, T32 — Status: done
- **Spec:** 12 §4 (those rows), 05 §5.2
- **Files:** `src/main/watchers/sources/{outlook-mail,outlook-calendar,onedrive,teams-chat}.ts`, fixtures, tests
- **Acceptance:** Delta-link paging, the first run drains without events, reminders once, the Teams per-chat cursor. ✅green.

#### T63 · Sources D: mcp-resource, mcp-poll, mac-calendar, mac-reminders — **S** — deps: T57, T22, T27 — Status: done
- **Spec:** 12 §4 (those rows)
- **Files:** `src/main/watchers/sources/{mcp-resource,mcp-poll,mac-calendar,mac-reminders}.ts`, tests (extend the echo fixture with `resources/list`, `resources/read`, `resources/subscribe` + an update notification triggered by a tool call)
- **Acceptance:** Subscription path and poll fallback both emit on change. mcp-poll refuses non-read-only tools without confirmation. JXA sources are mocked. ✅green.

#### T64 · Always-on UI: Dot Info section, watcher dialogs, event cards, Activity screen — **S** — deps: T59, T60, T45, T54 — Status: done
- **Spec:** 12 §5, 09 §4 (reuse components)
- **Files:** `src/renderer/src/features/dot-info/AlwaysOnSection.tsx`, `src/renderer/src/features/watchers/{WatcherList,AddWatcherDialog,watcher-forms}.tsx`, `src/renderer/src/features/chats/EventCard.tsx`, `src/renderer/src/features/activity/ActivityScreen.tsx`, `src/renderer/src/stores/runtime.ts`, rail item + route
- **Acceptance:** e2e `T64`: turn on Always on → add a local-webhook watcher → Test → POST → the event card ≤ 1 s → the streamed `[UPDATE]` reply → Activity shows counts and the next run. ✅green.

### M5b — SuperBot

#### T65 · Directory + DotProfiles + knowledge summaries — **S** — deps: T41, T59 — Status: done
- **Spec:** 13 §2–§3
- **Files:** `src/main/superbot/{directory,profile-service,bm25}.ts`, `src/main/ipc/handlers/superbot.ts`, tests
- **Acceptance:** Cards ≤ 700 chars with capabilities/dataSources derived deterministically. Top-12 selection by BM25 for > 6000 chars. Refresh triggers (10 msgs / 6 h / manual), the lowest-priority queue, the budget skip. ✅green.

#### T66 · SuperBot runtime: super Dot, tools, RBAC subject, @mentions — **S** — deps: T65, T38 — Status: done
- **Spec:** 13 §1, §4, §5 (main), §7; 07 §3.1
- **Files:** `src/main/dots/dot-service.ts` (`ensureSuperBot`, immutability), `src/main/runtime/extensions/superbot.ts`, `src/main/links/link-bus.ts` (`onDelta`), `src/main/links/link-policy.ts` (super subject, hiddenFromSuper), seed rule, tests
- **Acceptance:** Decision-table cases 19–22 pass. `ask_dots` runs requests in parallel (fake timers prove concurrency), streams `peer-stream` deltas per peer, and returns the attributed text. `get_dot_updates` needs no model call. @mention single and multi paths. The Super Dot can't be deleted. ✅green.

#### T67 · SuperBot UI: pinned chat, fan-out card, citations, mentions, briefing — **S** — deps: T66, T56, T64 — Status: done
- **Spec:** 13 §5, §6, §8
- **Files:** `src/renderer/src/features/superbot/{FanOutCard,CitationChip,MentionPicker,SuperInfo}.tsx`, the remark citation plugin in `Markdown.tsx`, composer mention support
- **Acceptance:** e2e `T67` (scripts `super-fanout`): the rows appear on `toolcall_end`, stream in parallel, the synthesis streams below, citation chips navigate. @mention picker. The briefing preset creates the schedule watcher. ✅green.

### M6b — Hardening

#### T68 · Always-on + Super e2e and soak test — **S** — deps: T64, T67 — Status: done
- **Spec:** 11 §3.2 steps 10–13, §3.3
- **Files:** `test/e2e/golden.spec.ts` (extend), `test/e2e/soak.spec.ts`, `.github/workflows/opendot-ci.yml` (nightly soak job)
- **Acceptance:** Golden steps 10–13 pass. The soak run meets every assertion in spec 11 §3.3.

### 6.1 Dependency graph (critical path)

```
T01 → T02 → T03 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T18 → … → T46 → T49 → T50
        └→ T04 ┘                         │      ├→ T21 → T22/T24 …
T01 → T05 → T06/T07 → T08, T09 ──────────┘      ├→ T25 → T26/T27/T37 …
                                                 └→ T41 → T42/T43 → T44/T45
T02 → T34 → T35 → T36   (can start right after T02; parallel track)
T14 → T55 → T16 → T18 → T56                         (streaming is on the critical path)
T15 → T57 → T58 → T59 → T64;  T57 → T60/T61/T62/T63 (sources fan out in parallel)
T59 + T41 → T65 → T66 → T67 → T68
```

Parallel tracks after T14: **Streaming** (T55–T56), **Tools** (T21–T29), **Stacks** (T30–T33, needs T25), **PII** (T34–T36),
**Links** (T37–T40), **Personality** (T41–T45), **Always on** (T54, T57–T64), **SuperBot** (T65–T67). Maximum useful parallelism ≈ 6 workers.

---

## 7. Out of scope for v1 (explicitly)

Voice input/output, mobile companion, multi-user/cloud sync, Windows/Linux builds (the code
stays portable, but only macOS is tested), Mac App Store, running Dots while the Mac sleeps or the app is quit (that would need a
cloud relay), true push for Gmail/Graph (needs a public webhook; v1 uses cursor polling), MCP Apps UI resources, pi OAuth subscription logins (Claude Pro /
ChatGPT) — v1.1, because pi supports them via `ModelRuntime` login flows.

## 8. Top risks

| Risk | Mitigation |
|---|---|
| pi API drift (1.x, fast-moving) | Pin `@earendil-works/pi-coding-agent` to an exact version. All pi calls go through `src/main/runtime/pi-adapter.ts` (spec 03 §1), so drift is fixed in one file. |
| Electron Node < pi's requirement | T01 asserts it on day 1. |
| GUI app has no shell PATH → `npx` MCP servers fail | `fix-path` at startup. The Connections screen shows "Node not found" with an install link. |
| pi codemode worker or wasm inside asar | `asarUnpack` rules (spec 11 §4) plus a packaged smoke test in T50. |
| PII false negatives | Redaction is best-effort. The UI says so. Custom terms list. Audit of what was redacted (types only). |
| Dot-to-Dot runaway loops / cost | Default deny, hop limit 3, cycle detection, per-link rate limits, global daily message budget. |
| 24/7 Dots burning tokens | Batching, per-Dot turns/hour + $/day budgets, a global $/day cap, `NO_UPDATE` replies, local models recommended for always-on Dots. |
| Hidden-app timer throttling (App Nap) / sleep | Catch-up on resume, an optional keep-awake setting, honest UI copy. |
| Streaming regressions | Latency + correctness assertions in e2e (spec 14 §5) on every PR. |

---

## 9. Build log (v0.1, built from this plan)

All tasks T01–T69 were implemented. Opus (orchestrator) wrote the shared contracts and the runtime core; Sonnet and
Haiku workers built the modules and screens in parallel waves against those contracts, and every wave was reviewed
with `typecheck + lint + tests` before the next one started.

**Verification**
- 500+ unit/integration tests (`npm test`), including the PII detector cases, the full Dot-Link decision table (incl. SuperBot),
  streaming emitter timing, watcher sources with recorded API shapes, OAuth/PKCE, connectors and the design system.
- 9 Playwright end-to-end tests drive the **real Electron app** with a scripted fake model: onboarding, prompt+connector Dot
  creation, MCP tool calls, approval deny, PII masking (asserts the model never sees the raw email/phone), memory, Dot Links with
  approval, always-on events (`[UPDATE]` streamed, `NO_UPDATE` silent), SuperBot parallel fan-out with citations, streaming
  (first token painted ~75 ms after send), and persistence across restarts in `~/.opendot`.
- The same e2e suite passes against the **packaged** app (asar, pi unpacked) and on GitHub's macOS runners (OpenDot CI).

**Deviations from the spec (intentional or deferred)**
- Storage moved to `~/.opendot/` (user request) with JSON files; pi transcripts and append-only logs are JSONL.
- Dot creation is prompt + connectors first (user request); templates are example prompts.
- Remote-MCP OAuth tokens are kept by pi in `~/.opendot/pi/mcp-auth.json` (0600), not the Keychain.
- macOS JXA tools (Calendar/Reminders/Contacts/Notes) are unit-tested with mocked `osascript`; they need a real Mac to verify.
- Google/Microsoft connectors are tested against recorded API shapes; a live sign-in needs your own OAuth client ID.
- Not yet: Tools footer listing "always allowed" actions, "Regenerate personality from description", the link transcript sheet,
  sticky day pill, notarization (needs an Apple Developer account).
