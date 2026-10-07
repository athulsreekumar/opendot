# OpenDot

**A team of AI assistants ("Dots") that live on your Mac or Windows PC.** OpenDot looks and feels like WhatsApp Desktop: every chat is a
Dot with its own personality, model, tools and permissions. Dots can run 24/7 in the background, react to new email, calendar
changes, files or webhooks as they arrive, talk to each other when you allow it, and a built-in **SuperDot** asks the right
Dots for you. Built on the open-source [pi agent harness](https://github.com/earendil-works/pi/tree/main/packages/coding-agent).

- **Any model**: cloud (Anthropic, OpenAI, Gemini, xAI/Grok, OpenRouter, Groq, Mistral, DeepSeek, …), on your computer (Ollama,
  LM Studio, llama.cpp, vLLM, auto-detected) or any OpenAI/Anthropic-compatible URL.
- **Create a Dot from a prompt**: describe what it should do, tick the connectors it may use, and OpenDot generates its name,
  emoji, colour, tagline and personality (streamed live). Templates are just example prompts.
- **Tools**: unlimited MCP servers (local or remote, import your Claude Desktop / Cursor config), Google Workspace, Microsoft 365,
  and computer capabilities (files, shell, screenshots, clipboard, notifications, plus Calendar, Reminders, Contacts and Notes on a Mac).
- **Always on**: watchers for Gmail, Outlook, calendars, Drive, OneDrive, Teams, folders, web pages, RSS, MCP resources, schedules
  and a local webhook. Dots reply with `[URGENT]`, `[UPDATE]` or stay quiet, within budgets you set.
- **SuperDot**: ask anything; it fans out to the right Dots in parallel, streams their answers live, then streams one answer
  with `[Inbox]`-style citations. `@Inbox …` asks one Dot directly.
- **Dot Links (RBAC)**: decide which Dots (or roles) can message which, when (schedules), how often, and whether you approve each message.
- **Private by default**: everything is stored in `~/.opendot` (`%USERPROFILE%\.opendot` on Windows) on your computer. Personal details (emails, phones, cards, keys…) are
  masked before they reach cloud models and restored locally. Tools that change things ask first.
- **Approvals inbox**: when a Dot wants to send, delete or run something, it asks in one place, with the details in plain
  language. Allow once, deny (with a reason the Dot sees), always allow, or edit the email, message, file or command first.
- **Memory**: each Dot remembers durable facts (`remember` / `forget`), plus a shared "About me" every Dot sees.
- **Streaming everywhere**: replies appear from the first token, including background replies and SuperDot fan-outs.

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
├─ audit/audit.jsonl               # what Dots did (no message contents)
├─ secrets.bin                     # API keys & OAuth tokens, encrypted with the macOS Keychain (Windows: DPAPI, tied to your Windows account)
└─ logs/main.log
```
Sessions resume where you left off after a restart. Deleting a Dot moves its folder to `~/.opendot/trash/`.

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
