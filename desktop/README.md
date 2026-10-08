# OpenDot

**A team of AI assistants ("Dots") that live on your Mac or Windows PC.** OpenDot looks and feels like WhatsApp Desktop: every chat is a
Dot with its own personality, model, tools and permissions. Dots can run 24/7 in the background, react to new email, calendar
changes, files or webhooks as they arrive, talk to each other when you allow it, and a built-in **SuperDot** asks the right
Dots for you. Built on the open-source [pi agent harness](https://github.com/earendil-works/pi/tree/main/packages/coding-agent).

- **Any model**: cloud (Anthropic, OpenAI, Gemini, xAI/Grok, OpenRouter, Groq, Mistral, DeepSeek, …), on your computer (Ollama,
  LM Studio, llama.cpp, vLLM, auto-detected) or any OpenAI/Anthropic-compatible URL.
- **Create a Dot from a prompt**: describe what it should do, tick the connectors it may use, and OpenDot generates its name,
  icon, colour, tagline and personality (streamed live). Templates are just example prompts.
- **Tools**: unlimited MCP servers (local or remote, import your Claude Desktop / Cursor config), Google Workspace, Microsoft 365,
  and computer capabilities (files, shell, screenshots, clipboard, notifications, plus Calendar, Reminders, Contacts and Notes on a Mac).
- **Knowledge**: point OpenDot at folders of notes and documents. It indexes them on your computer (BM25 search, no
  extra services), keeps the index current as files change, and any Dot you allow can search it and answer with
  source chips you can click to open the file.
- **Always on**: watchers for Gmail, Outlook, calendars, Drive, OneDrive, Teams, folders, web pages, RSS, MCP resources, schedules
  and a local webhook. Dots reply with `[URGENT]`, `[UPDATE]` or stay quiet, within budgets you set.
- **SuperDot**: ask anything; it fans out to the right Dots in parallel, streams their answers live, then streams one answer
  with `[Inbox]`-style citations. `@Inbox …` asks one Dot directly.
- **Organisation projects**: a team of Dots led by SuperDot as project manager plans a request, you approve it, and the work runs in parallel with reviews and a final report (see below).
- **Daily briefing**: once a day SuperDot asks your Dots what matters and sends one briefing and one notification (see below).
- **Quick ask**: press **Option+Space** (Mac) or **Alt+Space** (Windows) anywhere to open a small floating bar, even when
  OpenDot's window is closed. Ask SuperDot, or `@` a Dot, and the answer streams right there.
- **Dot Links (RBAC)**: decide which Dots (or roles) can message which, when (schedules), how often, and whether you approve each message.
- **Private by default**: everything is stored in `~/.opendot` (`%USERPROFILE%\.opendot` on Windows) on your computer. Personal details (emails, phones, cards, keys…) are
  masked before they reach cloud models and restored locally. Tools that change things ask first.
- **Approvals inbox**: when a Dot wants to send, delete or run something, it asks in one place, with the details in plain
  language. Allow once, deny (with a reason the Dot sees), always allow, or edit the email, message, file or command first.
- **Memory**: each Dot remembers durable facts (`remember` / `forget`), plus a shared "About me" every Dot sees.
- **Streaming everywhere**: replies appear from the first token, including background replies and SuperDot fan-outs.
- **Files and images in chat**: drag them onto the chat, paste an image, or use the paperclip. See "Files and images" below.

## Install (macOS 14+)

1. Download `OpenDot-<version>-arm64-mac.dmg` (Apple Silicon) or `-x64-mac.dmg` (Intel) from
   [Releases](https://github.com/athulsreekumar/opendot/releases) or from the latest
   [Desktop app CI](https://github.com/athulsreekumar/opendot/actions/workflows/desktop-ci.yml) run (artifact **OpenDot-mac**).
   Or build it yourself: see [Build from source](#build-from-source).
2. Open the DMG and drag OpenDot to Applications.
3. The build is **not notarized yet** (no Apple Developer account), so the first launch needs one of:
   - Right-click OpenDot in Applications → **Open** → **Open**, or
   - `xattr -dr com.apple.quarantine /Applications/OpenDot.app`
4. Follow the onboarding: pick a model (paste a key, use Ollama, or a custom URL), pick your first Dots, choose whether Dots keep
   running in the background.

## Install (Windows 10/11, x64)

1. Download `OpenDot-<version>-x64-win.exe` (installer) or `OpenDot-<version>-x64-win.zip` (portable, unzip and run
   `OpenDot.exe`) from [Releases](https://github.com/athulsreekumar/opendot/releases) or from the latest
   [Desktop app CI](https://github.com/athulsreekumar/opendot/actions/workflows/desktop-ci.yml) run (artifact **OpenDot-windows**).
   Or build it yourself: see [Build from source on Windows](#build-from-source-on-windows).
2. Run the installer. You can choose the install folder; it adds Desktop and Start menu shortcuts.
3. The build is **not code-signed yet** (no certificate), so Windows SmartScreen may show "Windows protected your PC" on first
   launch. Click **More info**, then **Run anyway**.
4. Optional but recommended: install [Git for Windows](https://git-scm.com/download/win). Dots use it for the **shell** tool
   (it provides `bash`). Without it, OpenDot says "Shell needs Git for Windows" in the This PC connection and in Dot info,
   and Dots are not offered a shell. Install it and restart OpenDot.
5. Follow the onboarding like on a Mac.

On Windows the built-in connection is called **This PC** and offers files, shell, screenshots, clipboard, notifications and
opening apps and links. Calendar, Reminders, Contacts and Notes are macOS only; use Google Workspace or Microsoft 365 for those.
Your data lives in `%USERPROFILE%\.opendot` (see below).

## Daily briefing

Off by default. Turn it on in **Settings → Daily briefing**, from SuperDot's info panel, from the "Get a daily briefing at 8:00"
chip in SuperDot's empty chat, or on the last onboarding step.

- Pick the time (default 08:00, your local time), weekdays or every day, which Dots contribute (default: every Dot with a
  calendar, email or similar connection; untick any), and optional extra instructions.
- At that time SuperDot asks the chosen Dots in parallel, skips the ones with nothing important, and streams one briefing with
  `[Calendar]`-style citations into its chat as a "Briefing · Tue 7 Oct" card. You get one notification, "Your briefing is
  ready"; clicking it opens SuperDot's chat at the card.
- If OpenDot was closed or the computer asleep at that time, the briefing runs when OpenDot next runs the same day before 18:00.
  It never runs twice in a day. The last run date is kept in `~/.opendot/briefing.json`.
- **Run briefing now** in Settings, or type `/briefing` in SuperDot's composer. A manual run counts as today's briefing.
- It respects your budgets: if the daily spending cap is used up (or Dots are paused) it skips with a short note. With no
  connected Dots it says so and suggests connecting Google or Microsoft. If one Dot fails, the briefing notes it ("Calendar
  didn't answer") and carries on.

## Quick ask

A system-wide shortcut opens a small bar in the upper part of the screen, from any app (OpenDot only has to be running;
with **Run in the background** on, closing the window is fine).

- Press **Option+Space** on a Mac or **Alt+Space** on Windows. Press it again, press **Esc** or click elsewhere to hide the bar.
- Type a question and press **Enter**. It goes to SuperDot, which asks the right Dots. Type `@` to pick a Dot (arrow keys and
  Enter) and the question goes to that Dot only.
- The answer streams in below the input. **Open in OpenDot** (or **Cmd/Ctrl+Enter**) shows the same chat in the main window;
  **Copy** copies the answer. The exchange is saved in that Dot's normal chat history.
- If a tool needs your approval, the bar shows "Needs your approval" with **Allow once** and **Deny**, and stays open until you answer.
- Settings → Quick ask turns it off or switches to **Ctrl+Shift+Space** or **Cmd/Ctrl+Shift+O**. If another app already owns
  the shortcut, Settings says so and you can pick a different one.

## Organisation: your team of Dots

An organisation is a team of Dots, one per department (Engineering, Security, HR, Finance and so on), with SuperDot as the project
manager. Open **Organisation** and pick a template: Startup, Software team, Small business or Full. OpenDot creates one Dot per
department, each with a short role description, a few skills, and access to files in its own workspace. Engineering, IT and Data can
also run shell commands on your computer, and every command still waits for your approval. All other connections stay off until you
turn them on for a Dot. Running setup again never makes duplicates, and removing a member keeps the Dot.

**Skills** are playbooks in plain text, such as "ship a change" or "review a contract". Each domain starts with built-in skills that
you can read but not change. Press Duplicate to make your own copy, or write a new skill in **Organisation → Skills**. Your skills are
markdown files in `~/.opendot/organisation/skills/`. Each member Dot sees a short list of its skills and opens one with the
`use_skill` tool when it needs it.

## Where your data lives

Everything is on your computer in `~/.opendot/` (`%USERPROFILE%\.opendot\` on Windows): plain JSON you can read:

```
~/.opendot/
├─ settings.json  connections.json  links.json  watchers.json  policy.json  usage.json
├─ memory.json                     # "About me", shared by all Dots
├─ ui-state.json                   # open Dot, drafts, layout
├─ dots/<dotId>/dot.json           # the Dot's identity, personality, grants
├─ dots/<dotId>/memory.json        # the Dot's long-term memory
├─ dots/<dotId>/sessions/*.jsonl   # chat transcripts (pi session format, one JSON object per line)
├─ dots/<dotId>/links/<peer>/      # conversations other Dots had with this Dot
├─ dots/<dotId>/events.jsonl       # events from its watchers
├─ dots/<dotId>/workspace/         # the only folder its file tools can touch (plus folders you add)
├─ knowledge/                      # Knowledge: folders.json and one index-<id>.json per indexed folder
├─ audit/audit.jsonl               # what Dots did (no message contents)
├─ secrets.bin                     # API keys & OAuth tokens, encrypted with the macOS Keychain (Windows: DPAPI, tied to your Windows account)
└─ logs/main.log
```
Sessions resume where you left off after a restart. Deleting a Dot moves its folder to `~/.opendot/trash/`.

## Files and images

Add files to a message by dragging them onto the chat ("Drop to add to the chat"), pasting an image (Cmd/Ctrl+V), or
clicking the paperclip. They appear as removable chips above the input. Up to 10 files per message; images up to 20 MB
(png, jpg, gif, webp), other files up to 10 MB. Folders are not accepted.

- **Images** go to the model as image content, as-is. If the Dot's model can't see images, the composer says so and
  offers to send them as file references only.
- **Text files** (txt, md, csv, json, code, html, xml, yaml, log, ...) are put into your message in a delimited block
  (very long files are shortened, with a note). They go through the same personal-details masking as typed text.
- **PDF, Word and other files** are not read for you. The Dot is told where the copy is.
- Every attachment is also copied to the Dot's workspace, in `dots/<id>/workspace/attachments/<timestamp>-<name>`.
- Sent messages show thumbnails (click to enlarge) and file chips (click to open, or show in the folder). They are
  still there after a restart.
- With SuperDot, attachments are forwarded to every Dot it asks. Images only reach Dots whose model can see them.

## Connecting Google and Microsoft

Both use your own OAuth client (so your data never passes through anyone else's app). OpenDot walks you through it in
**Connections → Google & Microsoft**:

- **Google**: Google Cloud Console → new project → enable Gmail, Calendar and Drive APIs → OAuth consent screen (External, add
  yourself as a test user) → Credentials → OAuth client ID → **Desktop app** → paste the client ID + secret into OpenDot → Sign in.
- **Microsoft**: entra.microsoft.com → App registrations → New → "Accounts in any organizational directory and personal Microsoft
  accounts" → Redirect URI: Public client/native `http://localhost` → Authentication → allow public client flows → paste the
  Application (client) ID → Sign in.

## Adding tools (MCP)

Connections → **Catalog** (one click for Filesystem, Memory, Fetch, Git, GitHub, Notion, Linear, Sentry, Context7, …),
**Add MCP server** (any local command or remote URL), or **Import JSON** (paste a Claude Desktop / Cursor / VS Code `mcpServers`
block). Then give a Dot access in **Dot info → Tools**, where each tool can be set to Allow, Ask or Block. Local MCP servers that
use `npx`/`uvx` need Node.js / uv installed.

## Approvals inbox

Click **Approvals** in the left rail (the badge counts what is waiting). **Waiting** shows one card per request: which Dot
asked, what it wants to do ("Send an email", "Run a command"), why (the Dot's own words), and the details (To, Subject and
message; the command; the file path and a preview).

- **Allow once** or press **A** on a focused card. **Deny** or **D**. **Deny with a reason** tells the Dot why so it can adapt.
- **Edit, then allow** or **E** for emails, chat messages, file content and commands. The tool runs with your edited version
  (pi lets a `tool_call` hook change the arguments in place) and the Dot is told which fields you changed.
- **Always allow for this Dot** is offered when it would take effect (not when you set an explicit Ask rule for that tool in
  Dot info → Tools). It is the same rule as before, listed in Dot info → Tools.
- With three or more requests they are grouped by Dot, each group with **Deny all**.
- **History** lists decisions (allowed, denied, edited, expired; by you or by an Always allow rule) and filters by Dot and
  outcome. It lives in `~/.opendot/audit/audit.jsonl` as one-line summaries with personal details masked, never message contents.
- When the window is not in front, a new request raises a notification ("Inbox wants to send an email"); several within 10
  seconds become one ("3 approvals waiting"). Clicking it opens the inbox. Requests that nobody answers still expire (5 minutes,
  30 for background work) and appear in History as Expired.

## Knowledge (search your own notes)

Connections → **Knowledge** → **Add folder**. OpenDot indexes Markdown, text, reStructuredText, Org, CSV, JSON, HTML
(tags stripped) and common source code. It skips hidden folders, `node_modules`, symlinks, files over 2 MB and binaries.
PDFs aren't indexed yet. The status, file count, size and last index time are shown for each folder, with **Re-index**
and **Remove** (your files are never touched). Changes are picked up automatically; only changed files are re-read.

Allow Knowledge for a Dot in **Dot info → Tools** (or tick it when you create the Dot) and it gets two read-only tools:
`knowledge_search` (best passages with file, heading and line range) and `knowledge_read` (a file or line range, only
inside your indexed folders). Answers show the files they used as chips: click to open the file, right-click to show it in
its folder. Passages reach a cloud model like any other tool output, so PII masking applies. The index lives in
`~/.opendot/knowledge/`.


## Organisation screens

The **Organisation** item in the rail (with a badge for things waiting on you) opens four views: **Projects** (the list, a
New project dialog, then a project page with plan review, a Board or List of tasks, a task drawer, Activity and a Summary),
**Team** (one card per domain Dot with its skills, Add a domain, Open chat), **Skills** (the playbook library: built-in skills
are read-only and can be duplicated, your own can be edited and deleted) and the first-run **set-up** with template cards and
"Choose domains". The routes are `#/organisation`, `#/organisation/<projectId>`, `#/organisation/team` and
`#/organisation/skills`. SuperDot's project updates show up in its chat as small cards with an "Open project" button.
## Organisation

A team of Dots, one per domain, led by SuperDot as project manager.

**Projects.** Ask SuperDot for something that needs several people ("add single sign-on for our customers"), or use New project in
Organisation. SuperDot writes a plan of tasks with an owner, dependencies and an optional reviewer, and nothing runs until you
approve it. Tasks without dependencies run in parallel (up to 3 at a time). Each task is a normal Dot Link message from SuperDot,
so Dot Links rules, approvals, budgets and PII masking apply. A Dot that needs you replies `[BLOCKED]` with a question, and your
answer continues the same conversation. Reviews: a Dot reviewer replies `[APPROVE]` or `[CHANGES]` (up to 2 rounds, then the task
is handed to you); you can also be the reviewer, or own a task yourself. Files a Dot creates under
`projects/<project>/<task>/` in its workspace are listed as deliverables and can only be opened from there. You can pause,
resume or cancel a project, set a budget, and retry or skip a failed task. If OpenDot closes, running projects come back paused.
SuperDot posts update cards in its chat, sends notifications for questions and reviews, writes a final report, and mentions
active projects in the daily briefing. Data: `~/.opendot/organisation/projects/<id>/project.json`.

## Build from source

```bash
git clone https://github.com/athulsreekumar/opendot.git
cd opendot/desktop
npm ci                 # Node 22.19+
npm run dev            # run with hot reload
npm run typecheck && npm run lint && npm test
npm run e2e            # drives the real app with a scripted fake model
npm run dist:mac:arm64 # DMG for Apple silicon only (on macOS), in release/
npm run dist:mac:x64   # DMG for Intel only
npm run dist:mac       # both
```
Set `OPENDOT_DATA_DIR=/tmp/somewhere` to use a separate data folder, and `OPENDOT_FAKE_PROVIDER=1` to get a scripted
"Fake (tests)" model that needs no API key.

### Build from source on Windows

Needs Node 22.19+ and Git (Git for Windows also gives the shell tool its `bash`). In PowerShell:

```powershell
git clone https://github.com/athulsreekumar/opendot.git
cd opendot\desktop
npm ci
npm run dev        # run with hot reload
npm run e2e        # drives the real app with a scripted fake model
npm run dist:win   # NSIS installer + zip for x64, in release\
```
Set `$env:OPENDOT_DATA_DIR = "C:\temp\opendot"` to use a separate data folder.

## Known limits (v0.1)

- Dots can't run while the computer is asleep or OpenDot is quit; watchers catch up on wake.
- Gmail/Outlook/Drive are checked every 30 s (no push without a public webhook).
- Not notarized (macOS) or code-signed (Windows) yet; macOS Gatekeeper and Windows SmartScreen show a warning on first launch.
- Remote MCP servers that need OAuth sign in the first time a Dot uses them; their tokens are stored by pi in
  `~/.opendot/pi/mcp-auth.json` (mode 600 on macOS) rather than the system secure storage.
- Mac Calendar/Reminders/Contacts/Notes use AppleScript (JXA); macOS asks for permission the first time. They do not exist on Windows.
- Windows: the shell tool needs Git for Windows; the Dock/menu bar options are macOS only (Windows uses the system tray).

The full design is in [`PLAN.md`](PLAN.md) and [`docs/spec/`](docs/spec/). MIT licensed.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root. Security problems: [SECURITY.md](../SECURITY.md).
