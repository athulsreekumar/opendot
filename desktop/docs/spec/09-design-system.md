# Spec 09 — OpenDot Design System ("Dotkit")

Personality: **calm, warm, precise.** A familiar messenger shape (WhatsApp Desktop), with more air, softer surfaces,
and one brand motif: **the dot**. You see it in the avatars, the typing indicator, the faint dot-grid chat wallpaper,
the unread pills, and the status rings.

Rules: UI code uses **only** these tokens (via Tailwind classes mapped in §2) and the components in §4.
No raw hex values in TSX. All interactive elements have a visible `:focus-visible` ring. Everything works in light and dark,
and with `prefers-reduced-motion`.

## 1. Tokens (`src/renderer/src/design-system/tokens.css`, T05 — verbatim)

```css
:root {
  /* ── Surfaces ── */
  --od-bg-app: #e9edf1;          /* window background behind panes */
  --od-bg-rail: #f6f7f9;         /* nav rail */
  --od-bg-sidebar: #ffffff;      /* dot list pane */
  --od-bg-chat: #f4f1ea;         /* chat canvas (warm paper) */
  --od-bg-elevated: #ffffff;     /* cards, dialogs, popovers */
  --od-bg-sunken: #f2f4f7;       /* inputs, code blocks */
  --od-bg-hover: #f2f4f7;
  --od-bg-active: #e9edf2;
  --od-bg-selected: #e3f4f0;     /* selected dot row */
  --od-overlay: rgb(16 24 40 / 0.45);
  --od-chat-dot: rgb(16 24 40 / 0.06); /* wallpaper dot color */

  /* ── Borders ── */
  --od-border-subtle: #e6e9ee;
  --od-border: #d6dbe2;
  --od-border-strong: #b9c1cc;

  /* ── Text ── */
  --od-text-primary: #111827;
  --od-text-secondary: #4b5563;
  --od-text-tertiary: #6b7280;
  --od-text-disabled: #9ca3af;
  --od-text-inverse: #ffffff;
  --od-text-link: #0b7f70;

  /* ── Brand / accent (teal) ── */
  --od-accent: #0e9f8a;
  --od-accent-hover: #0b8574;
  --od-accent-pressed: #096b5e;
  --od-accent-subtle: #e3f4f0;
  --od-accent-fg: #ffffff;
  --od-focus-ring: rgb(14 159 138 / 0.45);

  /* ── Bubbles ── */
  --od-bubble-out: #d7f3ea;      /* user */
  --od-bubble-out-fg: #0f2a24;
  --od-bubble-in: #ffffff;       /* dot */
  --od-bubble-in-fg: #111827;
  --od-bubble-system: #fff6e0;
  --od-bubble-link: #eef2ff;     /* dot-to-dot cards */

  /* ── Semantic ── */
  --od-success: #12a150;  --od-success-subtle: #e6f6ec;
  --od-warning: #d97706;  --od-warning-subtle: #fdf3e2;
  --od-danger:  #dc3545;  --od-danger-subtle:  #fdecee;
  --od-info:    #2563eb;  --od-info-subtle:    #e8effd;

  /* ── Dot palette: solid (avatar ring/stroke) + soft (avatar fill) ── */
  --od-dot-teal: #0e9f8a;   --od-dot-teal-soft: #d5f2ec;
  --od-dot-green: #16a34a;  --od-dot-green-soft: #dcf5e4;
  --od-dot-lime: #65a30d;   --od-dot-lime-soft: #ecf6d6;
  --od-dot-amber: #d97706;  --od-dot-amber-soft: #fcefd6;
  --od-dot-orange: #ea580c; --od-dot-orange-soft: #fde5d6;
  --od-dot-rose: #e11d48;   --od-dot-rose-soft: #fde1e7;
  --od-dot-pink: #db2777;   --od-dot-pink-soft: #fce1ef;
  --od-dot-violet: #7c3aed; --od-dot-violet-soft: #ece4fd;
  --od-dot-indigo: #4f46e5; --od-dot-indigo-soft: #e4e3fc;
  --od-dot-blue: #2563eb;   --od-dot-blue-soft: #dfe9fd;
  --od-dot-sky: #0284c7;    --od-dot-sky-soft: #daeffa;
  --od-dot-slate: #475569;  --od-dot-slate-soft: #e5e9ef;

  /* ── Typography ── */
  --od-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable", system-ui, sans-serif;
  --od-font-mono: "SF Mono", ui-monospace, Menlo, Monaco, monospace;
  --od-text-2xs: 11px; --od-lh-2xs: 14px;   /* badges, timestamps in bubbles */
  --od-text-xs: 12px;  --od-lh-xs: 16px;    /* meta, captions */
  --od-text-sm: 13px;  --od-lh-sm: 18px;    /* secondary UI, list previews */
  --od-text-md: 14px;  --od-lh-md: 20px;    /* body, chat text */
  --od-text-lg: 15px;  --od-lh-lg: 20px;    /* list titles, buttons lg */
  --od-text-xl: 17px;  --od-lh-xl: 22px;    /* pane titles */
  --od-text-2xl: 20px; --od-lh-2xl: 26px;   /* section headings */
  --od-text-3xl: 24px; --od-lh-3xl: 30px;   /* dialog titles, onboarding */
  --od-text-4xl: 32px; --od-lh-4xl: 38px;   /* welcome */
  --od-weight-regular: 400; --od-weight-medium: 500; --od-weight-semibold: 600; --od-weight-bold: 700;

  /* ── Space (4px grid) ── */
  --od-space-0: 0; --od-space-0_5: 2px; --od-space-1: 4px; --od-space-1_5: 6px; --od-space-2: 8px; --od-space-2_5: 10px;
  --od-space-3: 12px; --od-space-4: 16px; --od-space-5: 20px; --od-space-6: 24px; --od-space-8: 32px; --od-space-10: 40px;
  --od-space-12: 48px; --od-space-16: 64px;

  /* ── Radius ── */
  --od-radius-xs: 4px; --od-radius-sm: 6px; --od-radius-md: 8px; --od-radius-lg: 12px; --od-radius-xl: 16px;
  --od-radius-2xl: 20px; --od-radius-bubble: 14px; --od-radius-full: 9999px;

  /* ── Elevation ── */
  --od-shadow-xs: 0 1px 1px rgb(16 24 40 / 0.06);
  --od-shadow-sm: 0 1px 2px rgb(16 24 40 / 0.06), 0 1px 3px rgb(16 24 40 / 0.08);
  --od-shadow-md: 0 4px 8px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.05);
  --od-shadow-lg: 0 12px 24px -6px rgb(16 24 40 / 0.14), 0 4px 8px -4px rgb(16 24 40 / 0.06);
  --od-shadow-bubble: 0 1px 0.5px rgb(11 20 26 / 0.13);

  /* ── Motion ── */
  --od-dur-instant: 80ms; --od-dur-fast: 140ms; --od-dur-base: 200ms; --od-dur-slow: 280ms; --od-dur-slower: 400ms;
  --od-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --od-ease-emphasized: cubic-bezier(0.3, 0, 0, 1.2);
  --od-ease-exit: cubic-bezier(0.4, 0, 1, 1);

  /* ── Layout ── */
  --od-rail-w: 64px; --od-list-w: 360px; --od-drawer-w: 380px; --od-header-h: 60px; --od-titlebar-h: 40px;
  --od-chat-max-w: 860px;  /* message column max width */

  /* ── Z ── */
  --od-z-base: 0; --od-z-sticky: 10; --od-z-drawer: 30; --od-z-popover: 40; --od-z-modal: 50; --od-z-toast: 60; --od-z-tooltip: 70;
}

[data-theme="dark"] {
  --od-bg-app: #0a0e13;
  --od-bg-rail: #0f141a;
  --od-bg-sidebar: #111821;
  --od-bg-chat: #0c1117;
  --od-bg-elevated: #18212c;
  --od-bg-sunken: #0f151c;
  --od-bg-hover: #1a2430;
  --od-bg-active: #202c3a;
  --od-bg-selected: #12312c;
  --od-overlay: rgb(0 0 0 / 0.6);
  --od-chat-dot: rgb(255 255 255 / 0.045);

  --od-border-subtle: #1f2934;
  --od-border: #2a3644;
  --od-border-strong: #3a4858;

  --od-text-primary: #eef2f6;
  --od-text-secondary: #b3bdc9;
  --od-text-tertiary: #8794a4;
  --od-text-disabled: #586373;
  --od-text-inverse: #0b1015;
  --od-text-link: #4fd1bf;

  --od-accent: #2cc9b2;
  --od-accent-hover: #4fd8c4;
  --od-accent-pressed: #22a894;
  --od-accent-subtle: #10322d;
  --od-accent-fg: #04201c;
  --od-focus-ring: rgb(44 201 178 / 0.5);

  --od-bubble-out: #11463f;
  --od-bubble-out-fg: #e7f7f3;
  --od-bubble-in: #1a232e;
  --od-bubble-in-fg: #eef2f6;
  --od-bubble-system: #2b2513;
  --od-bubble-link: #1c2140;

  --od-success: #3ccf7c;  --od-success-subtle: #10291b;
  --od-warning: #f5a524;  --od-warning-subtle: #2e2210;
  --od-danger:  #f26b78;  --od-danger-subtle:  #351519;
  --od-info:    #6d9cff;  --od-info-subtle:    #152240;

  --od-dot-teal-soft: #113a34; --od-dot-green-soft: #12301d; --od-dot-lime-soft: #23300f; --od-dot-amber-soft: #36270d;
  --od-dot-orange-soft: #3a2010; --od-dot-rose-soft: #3a1520; --od-dot-pink-soft: #39152a; --od-dot-violet-soft: #2a1d47;
  --od-dot-indigo-soft: #23224a; --od-dot-blue-soft: #172747; --od-dot-sky-soft: #0f2c3d; --od-dot-slate-soft: #232c38;

  --od-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
  --od-shadow-md: 0 4px 10px -2px rgb(0 0 0 / 0.5);
  --od-shadow-lg: 0 16px 32px -8px rgb(0 0 0 / 0.6);
  --od-shadow-bubble: 0 1px 0.5px rgb(0 0 0 / 0.35);
}

@media (prefers-reduced-motion: reduce) {
  :root { --od-dur-fast: 0ms; --od-dur-base: 0ms; --od-dur-slow: 0ms; --od-dur-slower: 0ms; }
}
```
Contrast requirement (checked in T05 with a tiny script, or manually): text-primary / secondary on every surface ≥ 4.5:1,
tertiary ≥ 3:1, and accent-fg on accent ≥ 4.5:1 in both themes. Adjust the values in `tokens.css` only, and record the change here.

## 2. Tailwind v4 mapping (`styles.css`, T05 — verbatim)

```css
@import "tailwindcss";
@import "./design-system/tokens.css";
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --color-app: var(--od-bg-app);         --color-rail: var(--od-bg-rail);   --color-sidebar: var(--od-bg-sidebar);
  --color-chat: var(--od-bg-chat);       --color-elevated: var(--od-bg-elevated); --color-sunken: var(--od-bg-sunken);
  --color-hover: var(--od-bg-hover);     --color-active: var(--od-bg-active); --color-selected: var(--od-bg-selected);
  --color-overlay: var(--od-overlay);
  --color-border-subtle: var(--od-border-subtle); --color-border: var(--od-border); --color-border-strong: var(--od-border-strong);
  --color-fg: var(--od-text-primary);    --color-fg-2: var(--od-text-secondary); --color-fg-3: var(--od-text-tertiary);
  --color-fg-disabled: var(--od-text-disabled); --color-fg-inverse: var(--od-text-inverse); --color-link: var(--od-text-link);
  --color-accent: var(--od-accent); --color-accent-hover: var(--od-accent-hover); --color-accent-pressed: var(--od-accent-pressed);
  --color-accent-subtle: var(--od-accent-subtle); --color-accent-fg: var(--od-accent-fg);
  --color-bubble-out: var(--od-bubble-out); --color-bubble-out-fg: var(--od-bubble-out-fg);
  --color-bubble-in: var(--od-bubble-in);   --color-bubble-in-fg: var(--od-bubble-in-fg);
  --color-bubble-system: var(--od-bubble-system); --color-bubble-link: var(--od-bubble-link);
  --color-success: var(--od-success); --color-success-subtle: var(--od-success-subtle);
  --color-warning: var(--od-warning); --color-warning-subtle: var(--od-warning-subtle);
  --color-danger: var(--od-danger);   --color-danger-subtle: var(--od-danger-subtle);
  --color-info: var(--od-info);       --color-info-subtle: var(--od-info-subtle);

  --font-sans: var(--od-font-sans); --font-mono: var(--od-font-mono);
  --text-2xs: var(--od-text-2xs); --text-2xs--line-height: var(--od-lh-2xs);
  --text-xs: var(--od-text-xs);   --text-xs--line-height: var(--od-lh-xs);
  --text-sm: var(--od-text-sm);   --text-sm--line-height: var(--od-lh-sm);
  --text-md: var(--od-text-md);   --text-md--line-height: var(--od-lh-md);
  --text-lg: var(--od-text-lg);   --text-lg--line-height: var(--od-lh-lg);
  --text-xl: var(--od-text-xl);   --text-xl--line-height: var(--od-lh-xl);
  --text-2xl: var(--od-text-2xl); --text-2xl--line-height: var(--od-lh-2xl);
  --text-3xl: var(--od-text-3xl); --text-3xl--line-height: var(--od-lh-3xl);
  --text-4xl: var(--od-text-4xl); --text-4xl--line-height: var(--od-lh-4xl);

  --radius-xs: var(--od-radius-xs); --radius-sm: var(--od-radius-sm); --radius-md: var(--od-radius-md);
  --radius-lg: var(--od-radius-lg); --radius-xl: var(--od-radius-xl); --radius-2xl: var(--od-radius-2xl);
  --radius-bubble: var(--od-radius-bubble);

  --shadow-xs: var(--od-shadow-xs); --shadow-sm: var(--od-shadow-sm); --shadow-md: var(--od-shadow-md);
  --shadow-lg: var(--od-shadow-lg); --shadow-bubble: var(--od-shadow-bubble);

  --ease-standard: var(--od-ease-standard); --ease-emphasized: var(--od-ease-emphasized);
}

html, body, #root { height: 100%; }
body {
  margin: 0; background: var(--od-bg-app); color: var(--od-text-primary);
  font-family: var(--od-font-sans); font-size: var(--od-text-md); line-height: var(--od-lh-md);
  -webkit-font-smoothing: antialiased; user-select: none; /* text in bubbles/inputs re-enables selection */
}
.od-selectable { user-select: text; }
.od-drag { -webkit-app-region: drag; }  .od-no-drag { -webkit-app-region: no-drag; }
:focus-visible { outline: 2px solid var(--od-focus-ring); outline-offset: 2px; border-radius: var(--od-radius-sm); }
.od-chat-wallpaper {
  background-color: var(--od-bg-chat);
  background-image: radial-gradient(var(--od-chat-dot) 1px, transparent 1.2px);
  background-size: 18px 18px;
}
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--od-border); border-radius: 9999px; border: 3px solid transparent; background-clip: content-box; }
```
Font sizes use `text-md`, `text-sm` and so on. Never use `text-[13px]`. For the Dot palette, use the helper
`dotColorVars(color)` (§4.17), which returns `{ "--dot": var(--od-dot-<c>), "--dot-soft": var(--od-dot-<c>-soft) }`,
applied via `style`. This is the only allowed inline style besides geometry from libraries.

## 3. Motion principles

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Hover/press color | fast (140) | standard | `transition-colors` |
| New bubble enter | base (200) | emphasized | translateY 6px → 0, opacity 0 → 1, scale .98 → 1 (motion `layout` off) |
| Streaming text | — | — | no per-token animation. Re-render text only, keep caret-free |
| Typing indicator | 1200 loop | ease-in-out | 3 dots, opacity .3 → 1 and translateY 0 → -2px, staggered 160 ms |
| Drawer open/close | slow (280) | standard / exit | translateX 100% → 0 |
| Dialog | base | emphasized | scale .96 → 1 + fade. Overlay fade fast |
| Tool chip expand | base | standard | height auto via `motion` |
| List reorder (dot moves to top) | slow | standard | `motion` layout animation on DotListItem |
| Toast | base | emphasized | from bottom-right |
All of it collapses to 0 with reduced motion (tokens + `useReducedMotion()` in motion components).

## 4. Components (`src/renderer/src/design-system/components/`)

Conventions: `forwardRef` where it wraps a DOM element, `className` passthrough merged with `clsx`, variants via `cva`,
`data-state` attributes from Radix kept. Every component file exports a `<Name>Props` type.

### 4.1 Button
| Prop | Values | Default |
|---|---|---|
| variant | `primary` (accent bg, accent-fg) · `secondary` (elevated bg, border, fg) · `ghost` (transparent, hover bg-hover) · `danger` (danger bg, white) · `link` (no padding, link color, underline on hover) | primary |
| size | `sm` h-7 px-2.5 text-sm · `md` h-8 px-3 text-md · `lg` h-10 px-4 text-lg | md |
| loading | boolean → Spinner replaces leadingIcon, `aria-busy` | false |
| leadingIcon / trailingIcon | ReactNode (16px) | — |
Radius `md`, font-weight medium, gap 6px. Disabled → opacity .5, `cursor-not-allowed`. Pressed → accent-pressed (primary).

### 4.2 IconButton
Square `sm` 28 / `md` 32 / `lg` 36, radius `md`, ghost by default (`variant: ghost | secondary | accent`). **Required** `label`
prop → `aria-label` + Tooltip. Icon size 16/18/20.

### 4.3 Input
h-9, radius md, bg sunken, border subtle → border-strong on hover, accent ring on focus. Slots `leading` (icon) and `trailing`
(button, e.g. reveal). `invalid` → danger border + `aria-invalid`. Props pass through to `<input>`. `size="sm"` h-8.
Search variant: `leading=<Search/>`, radius full, used in the list pane.

### 4.4 TextArea
Same look as Input. `autoGrow` (min rows 1, `maxRows` default 8), `showCount` + `maxLength`.

### 4.5 Switch (Radix)
Track 32×18, thumb 14, accent when checked. `label` + optional `description` rendered as `<label>` with the right association.

### 4.6 Badge
`variant`: `unread` (accent bg, accent-fg, min-w 20, h 20, radius full, text-2xs semibold, shows "99+") · `muted` (bg-active, fg-2) ·
`success | warning | danger | info` (subtle bg + solid fg, h 20, px 6, radius sm, text-2xs medium) · `outline`.

### 4.7 Avatar (DotAvatar)
Props: `emoji`, `color: DotColor`, `size: xs 24 | sm 32 | md 40 | lg 48 | xl 96`, `status?: "online"|"busy"|"away"|"error"`, `ring?: boolean`.
Circle with fill `--dot-soft`, emoji centred at 55% of the size, optional 2px ring `--dot`. Status = 10px dot (xl: 18px) at the bottom-right
with a 2px border in the sidebar bg: online = success, busy = accent with a pulse (thinking), away = fg-3, error = danger.
`aria-label` = Dot name (passed as `name`).

### 4.8 Tooltip (Radix)
Delay 500 ms (0 inside a toolbar group). bg `fg` (inverted), text inverse, text-xs, radius sm, px 8, py 4, max-w 240. Optional `kbd` shortcut on the right.

### 4.9 Dialog (Radix)
Overlay `overlay`. Content: elevated, radius xl, shadow lg, width `sm` 400 / `md` 520 / `lg` 720, max-h 85vh with a scrolling body.
Header: title text-xl semibold + optional description fg-2. Footer right-aligned buttons, gap 8. Close IconButton top-right. Focus trapped. Esc closes.

### 4.10 Sheet (side panel, Radix Dialog with `modal={false}` option)
Right side, width `--od-drawer-w`, full height below the titlebar, bg sidebar, border-left subtle. Used for the Dot Info drawer and the link transcript.

### 4.11 DropdownMenu (Radix)
Elevated, radius lg, shadow md, p-1. Items h-8 px-2 radius sm, icon 16 + label + optional shortcut. `destructive` item uses danger fg. Separator: border-subtle.

### 4.12 Select (Radix)
Trigger looks like Input. Content like DropdownMenu. Supports `groups` (label + items) and an item `description` line (fg-3, text-xs). Used for model pickers.

### 4.13 Slider (Radix)
Track h-1 bg-active, range accent, thumb 16 white with a border and shadow-sm. Props `min`, `max`, `step`, `leftLabel`, `rightLabel` (text-xs fg-3 under the track), and `valueLabel` (shown on drag).

### 4.14 Tabs / SegmentedControl
Tabs: underline style, active fg + 2px accent bar. SegmentedControl: bg sunken, radius lg, p-0.5, items h-7, the active item bg elevated + shadow-xs. Used for tone and theme.

### 4.15 ScrollArea (Radix)
Thin overlay scrollbars (6px, border color thumb), auto-hide.

### 4.16 Toast, EmptyState, Spinner, Kbd
- Toast: bottom-right stack, elevated, radius lg, shadow lg, icon + title + description + optional action; auto-dismiss 4 s (errors 8 s). API `toast({ title, description?, variant?, action? })` via a Zustand store.
- EmptyState: centred icon (40px in a 72px accent-subtle circle), title text-xl, body text-md fg-2 max-w 360, optional primary action.
- Spinner: 16/20/24, a 2px ring with accent arc, `role="status"` `aria-label="Loading"`.
- Kbd: text-2xs mono, px 4, h 18, radius xs, border, bg sunken. Uses ⌘ ⇧ ⌥ glyphs.

### 4.17 DotListItem (domain)
Height 72, px 12, gap 12, radius lg (inset 4px inside the pane), hover bg-hover, selected bg-selected.
Layout: Avatar md (with status) | column: row 1 = name (text-lg semibold, truncate) + time (text-xs fg-3, accent when unread);
row 2 = preview (text-sm fg-2, 1 line, truncate) or **live status** in accent italic ("thinking…", "using Gmail…", "talking to Calendar…")
+ right side: pinned 📌 icon (12px fg-3), muted 🔕, unread Badge. Context menu (right-click and `⋯`): Pin, Mute, Mark read, Duplicate, Archive, Delete.
Helper `dotColorVars(color: DotColor): CSSProperties` lives in `design-system/dot-colors.ts`.

### 4.18 MessageBubble
- Container max-w `min(72%, 640px)`. Padding 8px 10px 6px. Radius `bubble`, with the corner nearest the tail at 4px (out: top-right; in: top-left)
  on the first bubble of a group. Shadow bubble.
- User (out): right-aligned, bg bubble-out. Dot (in): left-aligned, bg bubble-in. In a group, the first bubble of a Dot burst shows the
  name (text-xs semibold in `--dot`) only inside link transcripts.
- Grouping: consecutive messages from the same role within 5 min → 2px gap and no tail. Otherwise 10px gap.
- Footer inline at the bottom-right: time (text-2xs fg-3) and, for user messages, a status glyph (sent ✓ when accepted, ✓✓ accent when the Dot started responding).
- Content: Markdown (§4.22) with `od-selectable`. Images max 320 px wide, radius md.
- Error state: danger-subtle bg strip under the text, "Couldn't get a reply · Retry".
- Hover actions (top-right, floating, fade fast): Copy, Retry (last assistant only), and "Restore PII view" hidden by default.

### 4.19 ToolCallChip
Inline under the assistant text, inside the bubble. h 28, radius full, bg sunken, px 10, gap 6, text-xs:
icon (connection icon or 🔧) + label ("Gmail · search") + status (Spinner while running, ✓ success, ⚠ error, ⛔ blocked, ⏳ approval).
Click → expand (motion height) into a card: args as pretty JSON (mono, text-xs, max-h 240 scroll), result preview, and duration.
Multiple chips wrap. More than 3 collapse into "+N more steps".

### 4.20 TypingIndicator
A bubble-in with 3 dots (6px, fg-3) animating per §3. Shown while the status is thinking/typing and the assistant text is still empty.

### 4.21 DaySeparator
Centred pill, text-xs medium fg-2, bg elevated at 90% with backdrop blur, radius full, px 10, h 24: "Today", "Yesterday", "Monday", "12 Sep 2026". Sticky at the top while scrolling.

### 4.22 Markdown
`react-markdown` + `remark-gfm` + `rehype-highlight`. Paragraph spacing 6px. Lists with 18px indent. Inline code: mono text-sm, bg sunken, px 4, radius xs.
Code blocks: bg sunken, radius md, p 10, text-xs mono, horizontal scroll, header row with the language + Copy button. Tables: border-subtle, text-sm.
Links: link color, open externally via `api.app.openExternal`. **No raw HTML** (`skipHtml`). Highlight.js theme: two small CSS files mapped to tokens (light/dark), written by hand (≈ 15 rules).

### 4.23 Composer
Bar at the bottom of the chat: bg sidebar, border-top subtle, p 10 16. Inside: IconButton (+) menu (attach file — v1.1 disabled with a tooltip, "Insert template"),
TextArea (autoGrow, radius 2xl, bg elevated, placeholder "Message <Dot name>"), right: Send IconButton accent (arrow-up) / Stop (square) while streaming.
Hint row under it (text-2xs fg-3) only when streaming: "Enter queues a follow-up · ⌘↵ interrupts and steers".

### 4.24 ApprovalCard
Full-width card (inside the message flow, aligned left), bg elevated, border warning (1px) + left accent bar 3px warning, radius lg, p 12:
title (text-md semibold), detail (text-sm fg-2), collapsible "Details" with args JSON, buttons: **Allow once** (primary), **Always allow** (secondary,
tooltip "for this Dot and this tool"), **Deny** (ghost danger). Expiry countdown (text-2xs fg-3). Once resolved, it shrinks to a one-line chip "Allowed ✓" / "Denied".

### 4.25 Other domain pieces
- **StatusPill** (connection status): `connected` success, `connecting` info + spinner, `needs-auth` warning, `error` danger, `disabled` muted.
- **ConnectionCard**: 
  icon 40 in a radius-lg tile, title, description 2 lines, StatusPill, primary action (Install / Connect / Manage).
- **LinkCard** (message_dot render): bg bubble-link, peer avatar xs + "Asked **Calendar**", the request in fg-2 (2 lines, expandable), the reply in a quote block (border-left `--dot` of the peer).
- **PiiBadge**: 🛡 shield icon 14 + count, text-2xs, bg accent-subtle, radius full. Tooltip lists types.

## 5. Gallery (T08)
`#/gallery` (dev only) renders every component in every variant/size/state in a 2-column grid, with a theme toggle that renders both themes
side by side (each column sets `data-theme` on its wrapper). This is the visual regression baseline: e2e screenshots it.

## 6. Icons
lucide-react only. `design-system/icons.ts` re-exports the used icons under semantic names (`IconSend = ArrowUp`, `IconStop = Square`,
`IconApprove = ShieldCheck`, …), so swapping a glyph is one edit. Stroke width 1.75. Sizes 16 (inline), 18 (buttons), 20 (rail).

## 7. App icon & brand mark
Mark: a rounded square (radius 22%) in accent with **three white dots in a gentle arc** (the typing indicator, frozen). T50 produces `build/icon.icns`
from `build/icon.svg` (1024×1024) via `iconutil` (macOS) or electron-builder's PNG→ICNS conversion. Wordmark "OpenDot" in SF Pro Rounded Semibold if
available, else Inter semibold.
