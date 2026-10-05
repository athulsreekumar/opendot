# OpenDot website — build plan

The marketing site for **OpenDot**, the open-source Mac app that gives you a team of AI assistants ("Dots").
Goal: an Apple-product-page-quality site that explains the product in seconds, shows it working, and collects
**early-access signups that land in the owner's inbox**.

This document is written so that builder agents (Sonnet, Haiku) can complete every task without guessing, while the
orchestrator (Opus) assigns work, reviews it and integrates. Everything a worker needs — copy, tokens, timings,
file names, acceptance checks — is in here. If something is ambiguous, the worker stops and asks the orchestrator
instead of inventing.

---

## 0. Decisions already made

| Topic | Decision |
|---|---|
| Hosting | **Vercel** (Hobby, personal account), Git-connected to `athulsreekumar/opendot`, branch `main` = production. |
| Signups | `POST /api/early-access` (Vercel serverless, Node runtime) → **Resend**: notification email to the owner + contact saved in a Resend **Audience** (that is the signup list; exportable as CSV). |
| Hero video | **Real app footage**: the actual OpenDot app, driven by a script with realistic dummy data, screen-recorded, then edited into a polished film. |
| Mascot | **AI-generated, glossy 3D look** (image model), cut out on transparent backgrounds, several poses. |
| Platform tag | "Only available for Mac" pill in the hero and next to every signup button. |
| Fonts | Big, tight display type; smaller calm body type (see §4). |
| Process | Plan reviewed by the owner before building (this document). |

### Decisions still open (owner)
1. **Domain** — e.g. `opendot.app` / `getopendot.com`, or start on `opendot.vercel.app`. Affects OG URLs and the
   "from" address of emails (Resend can only email *the account owner* until a domain is verified — fine for
   notifications; confirmation emails to signups need a verified domain).
2. **Mascot credits** — the Higgsfield account has **0 credits** and the Figma plan is Starter/View seat (AI image
   generation is paid there too). Choose one: (a) top up Higgsfield (~a few dollars covers ~15 images),
   (b) use Figma AI credits if your plan has them, (c) fall back to a real-time 3D mascot rendered in the browser
   (React Three Fiber, glossy material, blinks and follows the cursor — no credits, fully animatable). See §7.
3. **Mascot name** — proposal: **"Odi"** (O-D, from OpenDot). Alternatives: Pip, Dotty, Orbi.
4. **"View source" link** — the app currently lives in `athulsreekumar/claude-code-remote/opendot`. Link there, move
   it to its own repo first, or hide the link until launch.

---

## 1. Orchestration protocol

**Roles**
- **Orchestrator (Opus)**: owns this plan, the task board (§12), the copy deck (§5) and design tokens (§4);
  reviews every PR-sized change; does integration, visual QA and the final launch checklist. Writes no large
  features itself unless a task is blocked twice.
- **Builder (Sonnet)**: sections with scroll choreography, the API route, the capture driver, the film edit.
- **Helper (Haiku)**: mechanical, well-specified work — scaffolding config, icons, image optimisation, dummy-data
  JSON, tests from a given list, README, meta tags.

**Rules for every worker**
1. Read §2–§5 plus the section(s) for your task. Do not change tokens, copy or file names; propose changes to the orchestrator.
2. Work only inside the files your task lists. Shared files (`tokens.css`, `copy.ts`, `layout.tsx`) are orchestrator-owned.
3. Before handing back: `pnpm lint && pnpm typecheck && pnpm test` pass, and your task's acceptance checks are met.
   Attach screenshots (desktop 1440 and mobile 390, light/dark if relevant) for any visual task.
4. Never commit secrets or the owner's email address. Configuration comes from env vars (§8).
5. Respect `prefers-reduced-motion` and keyboard access in everything (§6.4).
6. Hand back with: what changed, how you verified it, anything you could not do.

**Review loop**: orchestrator checks acceptance → either merges or returns with numbered fixes. A task returned twice
is taken over by the orchestrator.

---

## 2. Tech stack (pin exact versions in T01)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, latest stable) + React 19 + TypeScript strict** | Static pages + one serverless route; first-class on Vercel; `next/font`, `next/image`. |
| Styling | **Tailwind CSS v4** with CSS-variable tokens (`@theme inline`) | Same approach as the app; dark mode via variables. |
| Scroll choreography | **GSAP + ScrollTrigger** (`@gsap/react` `useGSAP` for cleanup) | Pinning and multi-stage scrubbed timelines are the core of an Apple-style page. |
| Smooth scroll | **Lenis**, synced to ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`, one rAF via `gsap.ticker`) | Premium inertia without scroll-jacking; disabled for reduced motion. |
| Small UI motion | CSS transitions / `motion` only where GSAP is overkill (button hovers, form states) | Keep JS on the scroll path minimal. |
| Validation | `zod` | API input. |
| Email + list | **Resend** SDK (`resend`) — `emails.send` + `contacts.create` (Audience) | Free tier: 3,000 emails/month, 100/day. |
| Rate limiting | `@upstash/ratelimit` + Upstash Redis **if** env present, else in-memory best effort | Optional; honeypot + timing trap always on. |
| Film edit | **Remotion** (in `film/`, separate package) using the system Chromium + ffmpeg | Programmatic edit: window chrome, zooms, titles, cursor, mascot. |
| Footage capture | Playwright `_electron` drives the app; **ffmpeg x11grab** records an Xvfb display at 2× | Crisp, 60 fps, real UI. |
| Lint/format | Biome | Same as the app. |
| Tests | Vitest (API, utils), Playwright (site e2e + visual), Lighthouse CI | §10. |
| Package manager | pnpm (workspace: root site + `film/` + `capture/`) | |

---

## 3. Repository layout

```
opendot/                         (this repo)
├─ PLAN.md                       this file
├─ README.md                     run, env vars, deploy, how to export signups
├─ package.json  pnpm-workspace.yaml  biome.json  tsconfig.json  next.config.ts  vercel.json
├─ .env.example                  every env var, no values
├─ app/
│  ├─ layout.tsx                 fonts, metadata, <SmoothScroll>, theme
│  ├─ page.tsx                   the landing page (composes sections in order)
│  ├─ privacy/page.tsx           short privacy notice for the signup form
│  ├─ api/early-access/route.ts  signup endpoint
│  ├─ opengraph-image.png        1200×630 (static, generated in T42)
│  ├─ icon.png  apple-icon.png   from the app icon
│  └─ robots.ts  sitemap.ts
├─ components/
│  ├─ site/      Nav.tsx  Footer.tsx  MacOnlyPill.tsx  EarlyAccessForm.tsx  EarlyAccessDialog.tsx  FilmDialog.tsx
│  ├─ sections/  Hero.tsx  Statement.tsx  CreateDot.tsx  AlwaysOn.tsx  SuperBot.tsx  DotLinks.tsx
│  │             Privacy.tsx  AnyModel.tsx  Connections.tsx  Streaming.tsx  OpenSource.tsx  FinalCta.tsx
│  ├─ motion/    SmoothScroll.tsx  Reveal.tsx  ScrubText.tsx  useReducedMotion.ts  gsap.ts
│  └─ ui/        Button.tsx  MacWindow.tsx  Screenshot.tsx  Mascot.tsx  Icon.tsx
├─ lib/          copy.ts (copy deck §5)  env.ts  early-access.ts (pure logic, unit-tested)  rate-limit.ts
├─ styles/       tokens.css  globals.css
├─ public/
│  ├─ film/      opendot-film-1080.mp4  opendot-film-720.mp4  opendot-film.webm  film-poster.avif/.jpg  film.vtt
│  │             hero-loop-1080.mp4  hero-loop.webm  hero-loop-poster.avif/.jpg
│  ├─ shots/     <name>-light@2x.avif/.webp  <name>-dark@2x.avif/.webp   (§7.1)
│  └─ mascot/    odi-<pose>.avif/.webp/.png (§7.3)
├─ capture/                      footage + screenshot tooling (dev only, not deployed)
│  ├─ README.md  package.json
│  ├─ seed/      dots.json  memory.json  scripts/*.json  (dummy data + fake-model scripts)
│  ├─ shots.ts   takes every screenshot in §7.1
│  ├─ scenes/    s1-sidebar.ts … s8-privacy.ts   (one driver per film scene)
│  ├─ record.sh  Xvfb + ffmpeg x11grab wrapper
│  └─ out/       raw recordings + cursor logs (git-ignored)
├─ film/                         Remotion project (dev only)
│  ├─ src/Root.tsx  src/Film.tsx  src/HeroLoop.tsx  src/parts/*.tsx
│  └─ render.sh                  renders + encodes all outputs into public/film
├─ tests/        e2e/*.spec.ts  unit/*.test.ts
└─ .github/workflows/ci.yml      lint, typecheck, unit, build, e2e, Lighthouse
```

---

## 4. Design system

Apple-page principles: one idea per screen, huge confident type, generous space, product imagery as the hero,
motion that explains rather than decorates, alternating light and dark "chapters".

### 4.1 Typography
- **Display & body: Inter** (variable, with the `opsz` optical-size axis) via `next/font/google`, `display: swap`,
  subsets latin. Use `font-variation-settings: "opsz" 32` for display sizes so it reads like a display face.
  (SF Pro is not licensed for the web; Inter Display is the closest free match.)
- **Mono: JetBrains Mono** (only for the `~/.opendot` tree and the PII token demo).
- Scale (fluid with `clamp`, px values at 390 → 1440 wide):

| Token | Size | Weight | Tracking | Line-height | Use |
|---|---|---|---|---|---|
| `display-xl` | 56 → 128 | 700 | -0.045em | 0.95 | Hero headline |
| `display-l` | 44 → 96 | 700 | -0.04em | 1.0 | Section headlines |
| `display-m` | 32 → 64 | 650 | -0.03em | 1.05 | Sub-chapters, statement text |
| `title` | 22 → 32 | 600 | -0.02em | 1.15 | Card titles |
| `lead` | 19 → 24 | 450 | -0.01em | 1.45 | Sub-headlines under display text |
| `body` | 16 → 18 | 400 | 0 | 1.55 | Paragraphs |
| `caption` | 13 → 14 | 500 | 0.01em | 1.4 | Pills, labels, footnotes |

- Headlines use `text-wrap: balance`; paragraphs `text-wrap: pretty`; max width 18ch for display, 60ch for body.

### 4.2 Colour (tokens in `styles/tokens.css`, mirrored for dark)
Brand colours come from the app (`opendot/src/renderer/src/design-system/tokens.css` and `build/icon.svg`); the
orchestrator copies the exact values in T02. Roles:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | #000000 | Page chapters alternate `--bg` / `--bg-alt` |
| `--bg-alt` | #F5F5F7 | #0B0B0D | |
| `--fg` | #1D1D1F | #F5F5F7 | Headlines |
| `--fg-2` | #6E6E73 | #A1A1A6 | Body, sub-headlines |
| `--accent` | app brand | app brand | CTA, links, highlights |
| `--accent-grad` | brand → brand-2 | same | Gradient text on 2–3 key words only |
| `--line` | rgba(0,0,0,.08) | rgba(255,255,255,.1) | Hairlines |

Chapters: Hero (light, or dark when OS is dark) → Statement (dark) → Create (light) → Always on (dark) →
SuperBot (dark, glow) → Links (light) → Privacy (dark) → Models/Connections (light) → Streaming (light) →
Open source (dark) → Final CTA (light). The site follows `prefers-color-scheme` only for the hero and nav;
chapters keep their designed contrast.

### 4.3 Layout & components
- Container max 1200px (text 980px), side gutter 16px mobile / 24 tablet / 40 desktop. No horizontal scroll at 320px.
- Section padding 120–200px vertical desktop, 80–120 mobile.
- **Button**: pill, 44px min height; primary = accent fill, white text; secondary = text link with chevron "›" (Apple style).
- **MacOnlyPill**: small rounded pill, Mac laptop glyph + "Only available for Mac" (secondary line where space
  allows: "macOS 14+ · Apple silicon & Intel"). Never use the  glyph (renders only on Apple devices).
- **MacWindow**: wraps screenshots/video in a macOS window (12px radius, traffic lights, subtle border, large soft shadow).
- **Screenshot**: `next/image` with explicit width/height, AVIF/WebP, light/dark variants swapped with `<picture>` media queries.
- Icons: Lucide (outline, 1.75 stroke). No third-party brand logos — tool and model names are set as text wordmarks.

---

## 5. Copy deck (`lib/copy.ts`, exact strings)

**Nav**: OpenDot (wordmark + mascot head) · Features · SuperBot · Privacy · [Get early access]

**Hero**
- Pill: *Only available for Mac*
- H1: **Your AI team.** ⏎ **Living on your Mac.**
- Lead: *OpenDot gives you Dots — AI assistants that each do one job brilliantly, work around the clock, and keep
  your data on your Mac.*
- CTAs: [Get early access]  ·  *Watch the film ›*
- Under the video: *Real app. Real-time. No edits to the answers.*

**Statement (scrubbed word-by-word)**: *Every Dot has a job, a personality, and only the access you give it.
Together, they never sleep.*

**Create a Dot** — H2: **Describe it.** ⏎ **It comes alive.**
1. *Tell it what to do.* "Watch my inbox and tell me what actually needs me."
2. *Pick what it can touch.* Gmail, Calendar, a folder — nothing else.
3. *Meet your new Dot.* OpenDot writes its name, look and personality — live, as you watch.

**Always on** — H2: **Works while you don't.** Lead: *Dots run quietly in the background. The moment an email lands,
a meeting moves or a file changes, the right Dot already knows — and only taps you when it matters.*
Badges: `[URGENT]` · `[UPDATE]` · *stays quiet*. Footnote: *Budgets you set keep every Dot in check.*

**SuperBot** — H2: **One question.** ⏎ **Every Dot.** Lead: *Ask SuperBot anything. It knows which Dots know what,
asks them all at once, and hands you one answer — with sources.*
Demo question: "What do I need to prepare for tomorrow?"

**Dot Links** — H2: **You decide who talks to whom.** Lead: *Let your Travel Dot ask your Calendar Dot — but only
on weekdays, only five times an hour, and only if you approve. Every message is logged.*

**Privacy** — H2: **Your data stays home.** Points:
- *Everything lives in `~/.opendot` on your Mac — plain files you can read.*
- *Emails, phone numbers and card details are masked before anything reaches a cloud model.*
- *Anything that changes the world — sending, deleting, paying — asks you first.*
- *Your keys are locked in the macOS Keychain.*

**Any model** — H2: **Any model.** ⏎ **Even the one on your Mac.** Lead: *Use Claude, GPT, Gemini, Grok and more —
or run fully local with Ollama or LM Studio. Switch per Dot.* (names as plain text wordmarks)

**Connections** — H2: **Plugs into everything.** Lead: *Google Workspace, Microsoft 365, your Mac's Calendar,
Reminders, Notes and files — plus unlimited MCP servers.*

**Streaming** — H2: **Answers from the first word.** Lead: *No spinners. Every reply streams in as it's written —
even from Dots working in the background.* (live demo text streams in on enter)

**Open source** — H2: **Open source. Built in the open.** Lead: *MIT-licensed, built on the pi agent harness.
Read every line, run your own build.* Link: *View on GitHub ›* (see open decision 4)

**Final CTA** — H2: **Be first in line.** Lead: *OpenDot is coming to the Mac. Join the early-access list and we'll
send you the download as soon as it's ready.* Form → pill under button: *Only available for Mac · macOS 14+*

**Form strings**: Email placeholder "you@example.com"; optional "What would your first Dot do?" (textarea, 280
chars); optional select "Your Mac": Apple silicon / Intel / Not sure. Button "Get early access". Success: *You're on
the list. We'll be in touch.* Duplicate: *You're already on the list — we'll be in touch.* Error: *Something went
wrong. Please try again in a minute.* Consent note: *We'll only email you about OpenDot. Privacy ›*

**Footer**: © OpenDot · Privacy · GitHub · "Made for Mac."

---

## 6. Page sections & scroll choreography

All scroll animation uses GSAP ScrollTrigger inside `useGSAP` (auto-cleanup) and animates only `transform`,
`opacity`, `clip-path`, `filter: blur` (small). `scrub` uses `0.6–1` for smooth catch-up. Pins use
`anticipatePin: 1`. Every pinned length is listed so the page height is predictable.

### 6.1 Global
- `SmoothScroll` (Lenis, `lerp 0.1`) mounted in layout; disabled when reduced motion or when a dialog is open.
- `Reveal` component: fade + 24px rise + 4px blur → 0, triggered once at `top 85%`, batched with `ScrollTrigger.batch`.
- Nav: transparent over hero, becomes blurred translucent (`backdrop-filter: saturate(180%) blur(20px)`) after 40px.
  "Get early access" in nav opens `EarlyAccessDialog`.

### 6.2 Sections
1. **Hero** (100svh, not pinned). On load: pill → H1 lines → lead → CTAs stagger in (0.08s). Below: `MacWindow`
   containing the **hero loop** video (muted, autoplay, loop, playsInline, poster). Scroll scrub (hero → +100vh):
   video window scales 0.86 → 1.0, radius 20 → 12px, H1 drifts up 60px and fades to 0.2. "Watch the film" opens
   `FilmDialog` (full film with sound toggle, captions, Esc to close, focus trapped).
   *Fallback*: if `saveData` or reduced motion → poster image + play button, no autoplay.
2. **Statement** (pinned +150vh, dark). `ScrubText`: words start at 15% opacity and light up to 100% in sequence with scroll.
3. **Create a Dot** (pinned +300vh). Left: the three steps; active step highlighted. Right: `MacWindow` crossfading
   `new-dot-describe` → `new-dot-review` → `new-dot-created`. **Odi (thinking pose)** peeks from the window's
   corner at step 2, pops to **Odi (cheer)** at step 3. Mobile: no pin — steps stack with their screenshot.
4. **Always on** (pinned +250vh, dark). Notification cards (Gmail "Invoice overdue — Northwind", Calendar "Board
   sync moved to 9:30", Drive "Q3 deck edited") slide in from the right one by one; each lands on a Dot in the
   sidebar screenshot and that Dot's row pulses; finally the `always-on-update` screenshot fades in with the
   `[URGENT]` reply. Odi (night/sleepy-but-awake pose) in the corner with a moon.
5. **SuperBot** (pinned +300vh, dark with radial accent glow). Centre: SuperBot node; around it 5 Dot nodes
   (Inbox, Calendar, Research, Money, Travel). Scroll draws SVG connection paths (`stroke-dashoffset`), small
   "asking…" chips travel along them, each Dot node lights up, then answers flow back and the screen transitions to
   the `superbot-answer` screenshot. Odi (conductor pose).
6. **Dot Links** (not pinned). Matrix diagram of Dots × Dots with allow/deny/ask chips that flip in on reveal;
   `links-screen` screenshot beside it.
7. **Privacy** (pinned +200vh, dark). Large text "maya.chen@example.com" morphs character-by-character into
   `⟦EMAIL_1⟧` (mono, accent), then a `~/.opendot` file tree draws in line by line; Odi (shield pose).
8. **Any model** (not pinned). Two rows of wordmarks marquee in opposite directions (CSS animation; paused on hover
   and for reduced motion). Short "Cloud · On your Mac · Any URL" trio below.
9. **Connections** (not pinned). Bento grid of 6 tiles (Google, Microsoft, Mac, MCP "unlimited", Webhooks, Files),
   batch-revealed; MCP tile has a counter that ticks "1, 2, 3 … ∞".
10. **Streaming** (not pinned). A chat bubble that types a real reply token-by-token at ~40 tokens/s when 50% in
    view, with a blinking caret; replays on re-enter.
11. **Open source** (dark). Big "MIT" outline text, pi credit, GitHub link.
12. **Final CTA** (light). Odi (waving, holding an envelope) above H2; inline `EarlyAccessForm`; Mac-only pill.

Total desktop page height ≈ 16–18 viewports. Mobile: pins 3, 4, 5, 7 become non-pinned stacked layouts with
simple reveals (use `ScrollTrigger.matchMedia`/`gsap.matchMedia` at `(min-width: 900px)`).

### 6.3 Performance budget
- LCP (hero H1 or poster) < 2.0s on Fast 4G mobile; CLS < 0.05; TBT < 200ms; Lighthouse mobile Performance ≥ 90.
- JS on landing ≤ 180 KB gz (GSAP+ScrollTrigger ≈ 45 KB, Lenis ≈ 4 KB). Sections below the fold hydrate as client
  components only where they animate; text is server-rendered.
- Hero loop ≤ 3 MB (1080p, H.264 + WebM, 12–15s); full film loaded only when the dialog opens.
- Images AVIF with WebP fallback, `sizes` set, all with width/height. Mascot ≤ 150 KB per pose.

### 6.4 Accessibility
- Reduced motion: no Lenis, no pins, no scrub; content shown in final state with plain fades; marquee and hero loop paused.
- All text is real text (no text baked into images). Screenshots have descriptive `alt`.
- Dialogs: focus trap, Esc, return focus, `aria-modal`. Video has captions (`film.vtt`) and a visible pause control.
- Colour contrast AA minimum; focus rings visible; tab order follows reading order; skip-to-content link.

### 6.5 SEO & sharing
- Title "OpenDot — your AI team, living on your Mac"; description = hero lead.
- OG/Twitter image 1200×630: H1 + Odi + window screenshot. `sitemap.ts`, `robots.ts`, canonical URL from `SITE_URL`.
- JSON-LD `SoftwareApplication` (operatingSystem "macOS", applicationCategory "ProductivityApplication", offers price 0).

---

## 7. Assets

### 7.1 Screenshots (real app, dummy data)
Captured by `capture/shots.ts` from the real app built from `claude-code-remote/opendot` at the
`claude/grok-bot-openai-dots-eyctdr` branch, window 1440×900 at device scale 2, both themes.

| Name | Screen / state |
|---|---|
| `sidebar-full` | Chats with 7 Dots, unread badges, SuperBot pinned on top |
| `new-dot-describe` | New Dot sheet, prompt typed, Gmail + Calendar ticked |
| `new-dot-review` | Generated identity streaming in (name, emoji, tagline, personality) |
| `new-dot-created` | The new Dot's first chat |
| `chat-streaming` | Mid-stream markdown reply (table + list) |
| `always-on-update` | Inbox Dot with an `[URGENT]` event reply and the event chip |
| `superbot-fanout` | SuperBot with peer-stream cards from 3 Dots streaming |
| `superbot-answer` | Final SuperBot answer with `[Inbox]` `[Calendar]` citations |
| `approval-card` | "Send email to Maya Chen?" Allow once / Always allow / Deny |
| `links-screen` | Dot Links rules matrix |
| `connections` | Connections hub with Google, Microsoft, Mac, 4 MCP servers |
| `settings-models` | Models: cloud + Ollama detected + custom URL |
| `privacy` | Privacy settings with masking on |
| `dot-info` | A Dot's info drawer: persona, tools with Allow/Ask/Block |

### 7.2 Dummy data (`capture/seed/`)
All people, companies and addresses are fictional; emails use `@example.com`, phones use 555 numbers.

| Dot | Emoji | Tagline | Connectors |
|---|---|---|---|
| SuperBot | ✨ | Asks the right Dots for you | — |
| Inbox | 📬 | Reads everything, flags what needs you | Gmail |
| Calendar | 📅 | Guards your time | Google Calendar |
| Research | 🔎 | Reads the web so you don't have to | Fetch (MCP) |
| Money | 💸 | Watches receipts and subscriptions | Gmail, Files |
| Travel | ✈️ | Plans trips, tracks flights | Calendar, Fetch |
| Code Buddy | 🧑‍💻 | Reviews your pull requests | GitHub (MCP) |

Cast: Maya Chen (Northwind Labs), Leo Park (designer), Sam Rivera (investor), "Acme Cloud" (a vendor).
Scripts (fake-model JSON, same format as the app's `test/fixtures/fake-scripts`): `create-inbox`, `inbox-urgent`,
`calendar-tomorrow`, `superbot-tomorrow` (fan-out to Inbox/Calendar/Travel/Research then a cited answer),
`research-summary` (markdown table), `money-subscriptions`, `approval-send-email`. Model speed for recording:
`OPENDOT_FAKE_TPS=45` (looks like a fast real model).

**Small app changes needed (app repo, task T20)**: `OPENDOT_FAKE_SCRIPTS_DIR` env var to load scripts from
`capture/seed/scripts`; `OPENDOT_CAPTURE=1` → frameless window at a fixed 1440×900 with no Linux title bar (the
film adds macOS chrome). Both are dev-only and off by default.

### 7.3 Mascot "Odi"
- **Character brief** (prompt base): *a small, friendly, glossy 3D character shaped like a perfect sphere — the
  OpenDot app icon come to life; soft subsurface glow in the brand gradient; two simple oval eyes with highlights,
  a tiny smile, little rounded arms, no legs, floats with a soft shadow; Pixar-like studio lighting, clean
  minimalist product render, plain light-grey background, centered, full body.*
- **Poses (8)**: `hero` (front, waving), `thinking` (hand on chin, small thought dots), `cheer` (arms up, sparkles),
  `night` (cozy, small moon + stars, eyes open), `conductor` (tiny baton), `shield` (holding a rounded shield),
  `envelope` (holding a letter), `peek` (only top half, peeking over an edge).
- **Process**: generate 4 variants of `hero` → owner/orchestrator picks one → generate the other poses using the
  chosen image as reference (image-to-image) for consistency → remove backgrounds → trim, 2× size, export AVIF/WebP
  plus PNG fallback; also a 512px `odi-head` for the nav/favicon.
- **Tool order**: Higgsfield `nano_banana_pro` / `flux_3_image` with reference (needs credits) → Figma
  `generate_image` (`gpt-image-2.5`) → fallback (c): procedural R3F mascot (§0 open decision 2).
- **Motion on the site**: idle float (±6px, 4s sine, CSS), gentle tilt toward the cursor on desktop (≤6°), pops in
  with a squash-and-stretch spring when its section activates. Static for reduced motion.

### 7.4 Film
- **Hero loop (12–15s, silent)**: sidebar → describe a Dot → personality streams → SuperBot answer streaming. Seamless loop.
- **Full film (~50s, 1080p60, burned-in titles + VTT captions, no music in v1)**:

| t (s) | Scene | Source | Title card |
|---|---|---|---|
| 0–4 | Odi floats in, blinks; logo | mascot | "Meet OpenDot." |
| 4–10 | Sidebar, Dots appear one by one | s1 | "A team of AI assistants. On your Mac." |
| 10–19 | Describe a Dot, tick Gmail, identity streams in | s2 | "Describe it. It comes alive." |
| 19–25 | Chat reply streams (table) | s3 | "Answers from the first word." |
| 25–31 | Email event arrives → `[URGENT]` | s4 | "Works while you don't." |
| 31–39 | SuperBot fan-out → cited answer | s5 | "One question. Every Dot." |
| 39–43 | Approval card → Allow once | s6 | "Nothing happens without you." |
| 43–47 | Privacy/`~/.opendot` | s8 | "Your data stays home." |
| 47–50 | Odi waves; "Get early access · Only available for Mac" | mascot | |

- **Edit (Remotion)**: footage placed in a `MacWindow` on a soft gradient background; slow push-ins (scale 1.0→1.08)
  on the area of interest using the cursor log; synthetic macOS cursor rendered from the log (real cursor hidden
  in capture); cross-dissolves 10 frames; titles in Inter Display 700 with the §4.1 tracking.
- **Encode**: H.264 High, CRF 20, `yuv420p`, `+faststart` (1080p ≈ 10–14 MB; 720p ≈ 5 MB); VP9 WebM; posters as
  AVIF + JPG; captions VTT.

---

## 8. Early-access backend

**Endpoint**: `POST /api/early-access` (Node runtime, `export const runtime = "nodejs"`), JSON body:
```ts
{ email: string; firstDot?: string /* ≤280 */; mac?: "apple-silicon" | "intel" | "unsure";
  company_website?: string /* honeypot, must be empty */; t: number /* ms since form render */ ;
  source?: "hero" | "nav" | "final" }
```
**Logic (`lib/early-access.ts`, pure + unit-tested; route is a thin wrapper)**
1. Parse with zod; email lower-cased/trimmed, RFC-ish check, max 254 chars. Invalid → 400 `{ok:false, error:"invalid"}`.
2. Honeypot filled or `t < 2500` → respond 200 `{ok:true}` but do nothing (don't tell bots).
3. Rate limit by IP (`x-forwarded-for` first hop): 5 per 10 minutes (Upstash if configured, else in-memory LRU).
   Exceeded → 429 `{ok:false, error:"rate"}`.
4. `resend.contacts.create({ audienceId: RESEND_AUDIENCE_ID, email, unsubscribed: false })`.
   If it reports the contact already exists → `{ok:true, duplicate:true}` and **no** notification email.
5. `resend.emails.send({ from: EARLY_ACCESS_FROM, to: EARLY_ACCESS_NOTIFY_TO, replyTo: email, subject:
   "New OpenDot early-access signup: <email>", text + simple HTML })` containing email, firstDot, mac, source,
   timestamp (UTC), country from `x-vercel-ip-country`, user-agent family. Values HTML-escaped.
6. If `EARLY_ACCESS_CONFIRM_FROM` is set (verified domain), send the signup a short confirmation email.
7. Any Resend failure → log, 502 `{ok:false, error:"server"}`; never leak details.

**Env vars** (`.env.example`, set in Vercel; never committed):
`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `EARLY_ACCESS_NOTIFY_TO` (the owner's inbox), `EARLY_ACCESS_FROM`
(default `OpenDot <onboarding@resend.dev>`), optional `EARLY_ACCESS_CONFIRM_FROM`, optional
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, `SITE_URL`.

**Form UX**: inline validation; button shows spinner then a check; success state replaces the form with the
success copy and Odi (cheer); dialog version closes after 2.5s on success. `localStorage` remembers a successful
signup to show "You're on the list" next time (try/catch guarded).

**Owner setup (documented in README, ~5 minutes)**: create a Resend account with the owner's email → API key →
Audiences → create "OpenDot early access" → copy its ID → paste the three values in Vercel → Project → Settings →
Environment Variables. Export signups any time from Resend → Audiences → Export CSV.

**Privacy page**: what's collected (email, optional answers), why (launch updates only), where (Resend, Vercel),
how to be removed (reply to any email / unsubscribe link).

---

## 9. Capture & film pipeline (how the builder runs it)

1. Build the app: `cd claude-code-remote/opendot && npm ci && npm run build`.
2. `capture/record.sh <scene>`: start `Xvfb :99 -screen 0 2880x1800x24`, launch the app via Playwright `_electron`
   with `OPENDOT_E2E=1 OPENDOT_FAKE_PROVIDER=1 OPENDOT_CAPTURE=1 OPENDOT_FAKE_SCRIPTS_DIR=… OPENDOT_FAKE_TPS=45
   OPENDOT_DATA_DIR=<fresh tmp seeded from capture/seed>` and `--force-device-scale-factor=2`; start
   `ffmpeg -f x11grab -framerate 60 -video_size 2880x1800 -draw_mouse 0 -i :99 -c:v libx264 -crf 12 -preset veryfast`;
   run the scene driver; stop ffmpeg; write `out/<scene>.mp4` and `out/<scene>.cursor.json`
   (`[{t, x, y, type: "move"|"down"|"up"}]`).
3. Scene drivers type with human cadence (35–70 ms/char, jitter), move the (logical) cursor along eased paths
   before clicks, and pause 600–900 ms on key states so the edit has room to breathe.
4. `capture/shots.ts` reuses the same seeding to take the §7.1 stills in light and dark.
5. `film/render.sh`: `npx remotion render` for `Film` and `HeroLoop` (browser = system Chromium), then ffmpeg encodes
   the deliverables listed in §7.4 into `public/film/`.

---

## 10. Testing & QA

- **Unit (Vitest)**: `early-access.ts` — valid/invalid emails, honeypot, timing trap, duplicate contact, Resend
  failure → 502, HTML escaping, rate limiter (fake clock).
- **E2E (Playwright, against `next build && next start`, Resend mocked via `RESEND_MOCK=1`)**:
  form submit happy path (hero dialog + final), duplicate, invalid email message, keyboard-only signup, film dialog
  opens/closes with Esc and returns focus, reduced-motion run (no pins, all content visible), no horizontal scroll at
  320/390/768/1024/1440, no console errors, all images load.
- **Visual**: screenshot each section at 390 and 1440 (light/dark OS) into `test-results/visual/` for orchestrator review.
- **Lighthouse CI**: mobile Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO 100.
- **Manual (orchestrator)**: scroll the whole page at 60 fps in Chromium with the performance panel; Safari-specific
  check list (backdrop-filter, AVIF, video autoplay) for the owner to run on a Mac.
- **CI**: GitHub Actions on push/PR — lint, typecheck, unit, build, e2e, Lighthouse.

---

## 11. Deployment

1. Owner (once): Vercel → Add New Project → import `athulsreekumar/opendot` (installs the Vercel GitHub app on the
   repo) → framework Next.js → add env vars (§8) → Deploy. (The orchestrator can create the project via the Vercel
   connector if preferred, but the Resend key is pasted by the owner, never sent through chat.)
2. Preview deployments for every branch/PR; `main` → production.
3. Optional domain: Vercel → Domains → add; then verify the same domain in Resend and set `EARLY_ACCESS_FROM` /
   `EARLY_ACCESS_CONFIRM_FROM` to `hello@<domain>`.
4. Post-deploy smoke: submit a real signup on the preview with a `+test` address → notification arrives → contact in
   Audience → delete test contact.

---

## 12. Task board

Model: **O** = orchestrator (Opus), **S** = builder (Sonnet), **H** = helper (Haiku). Tasks in the same wave run in parallel.

| ID | Wave | Task | Owner | Depends | Output / acceptance |
|---|---|---|---|---|---|
| T01 | 1 | Scaffold Next.js + TS strict + Tailwind v4 + Biome + Vitest + Playwright + pnpm workspace; pin versions | H | — | `pnpm dev/build/lint/typecheck/test` run clean; layout §3 folders exist |
| T02 | 1 | Design tokens (`tokens.css`), fonts in `layout.tsx`, type scale utilities, light/dark | O | T01 | Token page `/_dev/tokens` (dev only) shows every token |
| T03 | 1 | `lib/copy.ts` from §5 | H | T01 | Strings exactly as §5; typed export |
| T04 | 1 | UI primitives: Button, MacOnlyPill, MacWindow, Screenshot, Icon | S | T02 | Storybook-free demo route; a11y focus states |
| T05 | 1 | Motion infra: SmoothScroll (Lenis⇄ScrollTrigger), `useReducedMotion`, Reveal (batch), ScrubText, gsap registration | S | T01 | Demo route; reduced motion disables all; no leaks on route change |
| T10 | 1 | Early-access logic + route + rate limiter + unit tests (§8) | S | T01 | All unit cases pass; `RESEND_MOCK` path |
| T11 | 2 | EarlyAccessForm + EarlyAccessDialog + privacy page | S | T04, T10 | E2E form tests pass |
| T20 | 1 | App-side capture flags (`OPENDOT_FAKE_SCRIPTS_DIR`, `OPENDOT_CAPTURE`) in the app repo branch, with a unit test | S | — | Flags off by default; app e2e still green |
| T21 | 1 | Dummy data + 7 fake-model scripts (`capture/seed`) per §7.2 | H | — | JSON validates against the app's script format; all fictional |
| T22 | 2 | `capture/shots.ts` → all §7.1 stills, light+dark, optimised to AVIF/WebP | S | T20, T21 | 28 images in `public/shots/`, each < 350 KB |
| T23 | 2 | `capture/record.sh` + scene drivers s1–s8 with cursor logs | S | T20, T21 | 8 recordings, 60 fps, 2880×1800, cursor JSON |
| T30 | 1 | Mascot: generate hero variants (§7.3) | O | open decision 2 | 4 candidates shown to owner |
| T31 | 2 | Mascot: remaining 7 poses from chosen reference, bg removal, exports | S | T30 | 8 poses + head, AVIF/WebP/PNG, consistent look |
| T32 | 2 | `Mascot` component (float, cursor tilt, spring pop, reduced motion) | S | T04, T31 | Demo route |
| T40 | 3 | Remotion film + hero loop (§7.4) + `render.sh` encodes | S | T23, T31 | Files in `public/film/` within size budgets; VTT captions |
| T41 | 3 | FilmDialog + hero video element with fallbacks | S | T04, T40 | E2E dialog tests pass |
| T42 | 3 | OG image, icons, JSON-LD, sitemap, robots, metadata | H | T31, T22 | Validates in a meta-tag checker |
| T50 | 3 | Nav + Hero (§6.2-1) | S | T04, T05, T11, T41 | Matches choreography; LCP budget |
| T51 | 3 | Statement + Create a Dot (§6.2-2,3) | S | T05, T22, T32 | Pins correct; mobile stacked |
| T52 | 3 | Always on + SuperBot (§6.2-4,5) | S | T05, T22, T32 | SVG fan-out draws smoothly at 60 fps |
| T53 | 3 | Dot Links + Privacy (§6.2-6,7) | S | T05, T22, T32 | Morph text works; reduced-motion end state |
| T54 | 3 | Any model + Connections + Streaming (§6.2-8,9,10) | S | T05 | Marquee pauses; streaming demo replays |
| T55 | 3 | Open source + Final CTA + Footer (§6.2-11,12) | H | T04, T11, T32 | Form inline works |
| T60 | 4 | Assemble `page.tsx`, chapter colours, cross-section polish, ScrollTrigger refresh after media load | O | T50–T55 | Whole page scrolls cleanly; no layout jumps |
| T61 | 4 | E2E + visual + reduced-motion + overflow suite (§10) | H | T60 | All green |
| T62 | 4 | Lighthouse CI + perf fixes to budget (§6.3) | S | T60 | Scores met |
| T63 | 4 | CI workflow | H | T61 | Green on GitHub Actions |
| T64 | 4 | README (run, env, deploy, export signups, re-capture, re-render film) | H | T60 | Owner can follow it cold |
| T70 | 5 | Vercel project + preview deploy + smoke signup (§11) | O | T63, owner env vars | Notification email received |
| T71 | 5 | Final review with owner; launch | O | T70 | Owner sign-off |

**Critical path**: T20/T21 → T23 → T40 → T41 → T50 → T60 → T70. Mascot (T30) waits on open decision 2; everything
else can proceed with placeholder art (`Mascot` renders a simple sphere until poses exist).

---

## 13. Definition of done
- Page matches §5 copy and §6 choreography at 390 and 1440, light and dark OS, reduced motion on/off.
- Hero shows the Mac-only pill, a playing real-footage loop, and a working "Get early access".
- A real signup on the deployed site produces an email in the owner's inbox and a contact in the Resend Audience.
- Budgets in §6.3 met; all tests and CI green; README lets the owner redeploy, re-capture and re-render alone.
