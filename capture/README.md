# capture/

Screenshots and screen recordings of the **real OpenDot app** with dummy data, used by the website and the film.
Nothing here is deployed. Everything is fictional: Jordan Avery (the user), Maya Chen (Northwind Labs), Leo Park,
Sam Rivera, Acme Cloud, `@example.com` addresses and 555 phone numbers.

The app runs with its scripted "fake" model (no API key, no network), so the answers are exactly what the scripts say,
streamed at a realistic speed.

## One-time setup

```bash
# 1. Build the app (it lives in desktop/ of this repo)
cd desktop && npm ci && npm run build

# 2. Install this package (playwright-core 1.63.0 to match the app's @playwright/test, sharp, tsx)
cd /path/to/opendot/capture && npm install
```

Needs `Xvfb` on the PATH (and `ffmpeg` for the film footage; stills do not need it). The app is taken from `desktop/`;
set `OPENDOT_APP_DIR` to use a build somewhere else.

## Re-run everything

```bash
capture/run-shots.sh            # 23 stills x light/dark -> public/shots/*.avif + .webp, PNG masters in capture/out/shots/
capture/record.sh               # 8 scenes -> capture/out/<scene>.mp4 + .cursor.json, copied to public/film/raw/
```

Options:

```bash
capture/run-shots.sh --only sidebar-full,approval-card --theme dark
capture/run-shots.sh --reuse                 # skip rebuilding the seeded data dirs
capture/record.sh s3-chat s5-fanout          # some scenes only
OPENDOT_SCENE_THEME=dark capture/record.sh s1-sidebar
OPENDOT_FAKE_TPS=45 ...                      # fake model speed in tokens/s (default 45 for film, 30 for stills)
```

Both scripts start their own virtual display (`Xvfb` at 2880x1800), so they work on a headless machine.

## Stills (`shots.ts`)

Window 1440x900 CSS px at device scale 2 = 2880x1800. Output per name and theme:
`public/shots/<name>-<light|dark>@2x.avif` (quality about 60) and `.webp` (about 80), each under 350 KB
(quality is lowered automatically if not). Lossless PNG masters go to `capture/out/shots/` (git-ignored).

| Name | State |
|---|---|
| `sidebar-full` | 7 Dots, unread badges, SuperDot pinned on top |
| `new-dot-describe` | New Dot sheet, prompt typed, Gmail + Google Calendar ticked |
| `new-dot-review` | Identity streaming in (name, emoji, tagline, personality) |
| `new-dot-edit` | Extra: the review form after generation |
| `new-dot-created` | The new Dot's first chat, "Inbox is ready" toast |
| `chat-streaming` | Mid-stream reply (table + list), Research Dot |
| `always-on-update` | Inbox with an event chip and an `Urgent` reply |
| `superbot-fanout` | SuperDot with four Dots streaming in parallel (file name kept from PLAN §7.1) |
| `superbot-answer` | The cited final answer |
| `approval-card` | "Inbox wants to use Gmail · send draft": Allow once / Always allow / Deny |
| `links-screen` | Dot Links graph and rules |
| `connections` | Google, Microsoft, Mac and four MCP servers, all connected |
| `settings-models` | Cloud providers, Ollama (3 models) and a custom URL |
| `privacy` | Privacy settings with the live masking demo |
| `dot-info` | Code Buddy's info drawer: tools with Allow / Ask / Block |
| `org-setup` | Organisation first run: four template cards, "Software team" selected, name "Northwind Labs" |
| `org-team` | Team tab: six department Dots (Engineering, Product, Design, Security, IT, Data) with skill chips |
| `org-plan` | "Add single sign-on for customers" waiting for approval: SuperDot's plan and the editable task list (shot at a 0.75 zoom so more rows fit) |
| `org-board` | Running project: board with To do / In progress / In review / Done filled, one "Waiting for you" card, activity list |
| `org-drawer` | Task drawer on "Update the onboarding docs": Support's question and the typed answer |
| `org-summary` | Finished project: SuperDot's final report and the task list |
| `org-skills` | Skills tab: built-in skills grouped by domain |
| `org-chat` | SuperDot chat with plan, question and review update cards, each with an Open project button |

The `org-*` stills run the app with `OPENDOT_FAKE_TPS=400` and the script `seed/scripts/org-sso.json` (built by
`seed/build-scripts.mjs`), set up the Organisation through the app's own API and drive the real approve, answer and
review steps. They scroll the Organisation screen to the top, so no frame starts mid-page.

## Film footage (`record.sh`, `scenes/`)

`record.sh` starts `Xvfb :99 -screen 0 2880x1800x24`, seeds the data dirs, then runs each scene driver. The app is launched
frameless at 1440x900 with `--force-device-scale-factor=2`, so it fills the screen exactly. ffmpeg `x11grab` records at
60 fps (`-draw_mouse 0`, libx264 `-crf 12 -preset veryfast`, `yuv420p`).

Per scene you get:

* `<scene>.mp4`: 2880x1800, 60 fps, about 1 s of head and tail around the action.
* `<scene>.cursor.json`: `[{ t, x, y, type }]`, `t` in ms from the first recorded frame, `x`/`y` in logical px
  (window coordinates), `type` is `move`, `down` or `up`. The real cursor is not recorded; the cursor eases along a
  slightly curved path before every click so the edit can draw a macOS cursor from this log.
* `<scene>.marks.json`: named moments (`send`, `approval`, `answer`, ...) in the same time base.

| Scene | What happens |
|---|---|
| `s1-sidebar` | The sidebar fills up one Dot at a time, then Inbox opens |
| `s2-describe` | New Dot: type the prompt, tick Gmail and Calendar, identity streams in, Create |
| `s3-chat` | Ask Research a question, the table reply streams in |
| `s4-alwayson` | An email event arrives, Inbox flags it `Urgent` |
| `s5-fanout` | One question to SuperDot, four Dots answer in parallel, cited answer |
| `s6-approval` | Send-email action asks first, cursor clicks Allow once |
| `s7-links` | Dot Links: switch a rule off and on |
| `s8-privacy` | Typing an email, phone and card number; the model only sees placeholders |

Typing uses 35 to 70 ms per character (longer after punctuation); key states are held for 600 to 900 ms.

## How it works

* `lib/app.ts`: launches the built app through Playwright `_electron` with `OPENDOT_E2E=1 OPENDOT_FAKE_PROVIDER=1
  OPENDOT_CAPTURE=1 OPENDOT_FAKE_SCRIPTS_DIR=capture/seed/scripts OPENDOT_FAKE_TPS=...`. Entry is
  `lib/main-wrapper.cjs`, which installs `seed/mock-google.cjs` and then starts the real app.
* `seed/`: the dummy world.
  * `dots.json`: SuperDot (the built-in Dot, renamed) plus Inbox, Calendar, Research, Money, Travel, Code Buddy with
    personalities, taglines, emojis, colours, connectors and tool rules; the shared "About me" memory.
  * `histories.json` + `scripts/history-*.json`: earlier chats, played through the real app so sidebar previews,
    tool chips and link cards are genuine. Timestamps are then moved onto a believable timeline (yesterday, this morning,
    minutes ago) and unread badges are set.
  * `scripts/*.json`: fake-model scripts in the app's format (generated by `build-scripts.mjs`):
    `create-inbox`, `inbox-urgent`, `inbox-update`, `calendar-moved`, `calendar-tomorrow`, `superbot-tomorrow`,
    `research-summary`, `money-subscriptions`, `approval-send-email`, `event-quiet`, `history-*`.
  * `mock-google.cjs`: answers Gmail, Calendar, Drive and a local Ollama with fictional data, so the app's real Google
    tools run (search results, drafts, "send" after Allow once) with no network and no account.
  * `fake-mcp.mjs`: stand-in MCP servers (Fetch, GitHub, Filesystem, Notion) so Connections shows real tool lists.
  * `build-data-dir.ts`: writes connections and (fake) OAuth tokens, adds providers, creates the Dots through the app's own
    API, plays the histories, retimes everything. `build-all.ts` builds the two variants in `capture/out/seeds/`
    (`full`, and `noinbox` so the New Dot flow can create Inbox live).
* Parallel fan-outs use the app's `{"byDot": {"Inbox": "...", "Calendar": "..."}}` script step (T20 follow-up), so each
  Dot gets its own reply no matter which one the app calls first.
* The app names "Inter Variable" in its font stack but does not bundle it; the capture injects the Inter font from the
  app's `@fontsource-variable/inter` package (macOS users get SF Pro).
* While a reply streams the app does not keep following the newest line, so `followChat()` scrolls the chat smoothly like
  a reader would.
* `coverScreen()`: a 1440x900 window leaves one black pixel row and column on the 2880x1800 Xvfb screen; recordings grow
  the content area by one CSS pixel so the window covers it.

## Editing the story

Change words in `seed/dots.json`, `seed/histories.json` or `seed/build-scripts.mjs`, run `node seed/build-scripts.mjs`
(regenerates `seed/scripts/*.json`), then re-run the capture. Keep text free of em dashes and real names.

## Troubleshooting

* `Electron executablePath not found`: build/install the app first (`npm ci && npm run build` in the app folder).
* Black or missing window in recordings: make sure no other X server uses `:99`.
* Stills time out waiting for text: the scripts changed; rebuild seeds (run without `--reuse`).
