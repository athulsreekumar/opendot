# UI worker brief (renderer)

You are building part of the OpenDot renderer (React 19 + Tailwind v4 + Zustand) in ``desktop/` in the opendot repo`.
Dependencies are installed. **Never run npm install, never edit package.json, never commit, never touch files outside your list.**

## Read first
- `PLAN.md` §0.3 (golden rules) — especially: only design-system components + tokens, no hex colours, no inline style except dynamic `dotColorVars(color)`; streaming is mandatory.
- `docs/spec/09-design-system.md` (tokens/classes/component specs) and `docs/spec/10-screens.md` (layouts + copy) — the sections named in your task.
- `src/shared/types.ts`, `src/shared/ipc.ts` (the `OpenDotApi` — every backend call you may make).

## What already exists (import, don't rewrite)
- `@/lib/api` → `api` (window.opendot, typed `OpenDotApi`), `errorText(e)`.
- `@/lib/format` → `listTime`, `bubbleTime`, `dayLabel`, `relativeTime`, `humanDur`.
- `@/app/router` → `useRoute()`, `navigate(hash)`, `Route`.
- Stores (`@/stores/...`): `useDots` (dots sorted Super→pinned→recent, statuses, create/update/remove/duplicate/markRead, byId, superDot),
  `useChat` (byDot[dotId] = { byId, order, hasMore, loading, loaded }, loadHistory, loadMore, send(dotId, text, mode), abort, clear, messages(dotId)),
  `useSettings` (settings, providers, models, load, update, refreshModels), `useApprovals` (pending, respond(id, decision), forDot),
  `useRuntime` (health, connections, connectionStatus, exchanges, loadHealth, loadConnections), `useUi` (drawerOpen, toggleDrawer, setDrawer,
  listWidth, setListWidth, newDotOpen, setNewDotOpen, drafts, setDraft, focused). Events from main are already wired into these stores.
  Subscribe with selectors (`useChat((s) => s.byDot[id])`) to avoid re-rendering on unrelated changes.
- Design system: `@/design-system/components` (Button, IconButton (requires `label`), Input, TextArea (autoGrow/maxRows/showCount), Switch,
  Badge, Avatar (emoji, color, size xs|sm|md|lg|xl, status, ring, name, mark), Tooltip/TooltipProvider, Dialog/DialogFooter, Sheet, Menu/MenuTrigger/
  MenuContent/MenuItem/MenuSeparator, Select (groups), Slider, Tabs/TabsList/TabsTrigger/TabsContent, SegmentedControl, ScrollArea, toast()/Toaster,
  EmptyState, Spinner, Kbd, StatusPill). Read the component files for exact props. `@/design-system/icons` (semantic lucide icons),
  `@/design-system/cn` (`cn(...)`), `@/design-system/dot-colors` (`dotColorVars(color)`).
- Tailwind colour classes come from spec 09 §2 (`bg-app bg-sidebar bg-chat bg-elevated bg-sunken bg-hover bg-selected text-fg text-fg-2 text-fg-3
  border-border-subtle bg-accent text-accent-fg bg-accent-subtle text-accent bg-bubble-out bg-bubble-in bg-bubble-system bg-bubble-link text-success
  bg-success-subtle text-warning bg-warning-subtle text-danger bg-danger-subtle …`), font sizes `text-2xs … text-4xl`, radius `rounded-bubble`, shadows
  `shadow-bubble`. The chat wallpaper class is `od-chat-wallpaper`. Drag regions: `od-drag` / `od-no-drag`. Selectable text: `od-selectable`.
- Dot avatar colours: `<Avatar color={dot.appearance.color} emoji={dot.appearance.emoji} name={dot.name} mark={dot.kind === "super"} />`.

## Conventions
- Named exports, function components, files in your feature folder. Copy text = sentence case, friendly, no jargon.
- Async actions: show a Spinner/loading state; errors → `toast({ title, description: errorText(e), variant: "error" })`.
- Accessibility: buttons have labels, inputs have `<label>`/aria-label, keyboard reachable.
- Tests (optional but welcome for logic): `*.test.tsx` with `// @vitest-environment jsdom` first line; mock `@/lib/api` with `vi.mock`.

## Checks you must pass before reporting (from `desktop/` in the opendot repo)
- `npx tsc -p tsconfig.web.json --noEmit` (errors in other workers' files: wait a minute and retry; report if they persist)
- `npx biome check <your files> --write` then `npx biome check <your files>` clean
- `npx vitest run <your test files>` if you wrote any
Report: files created, check outputs, anything you couldn't do.
