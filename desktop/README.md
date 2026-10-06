# OpenDot

**A team of AI assistants ("Dots") that live on your Mac.** OpenDot looks and feels like WhatsApp Desktop: every chat is a
Dot with its own personality, model, tools and permissions. Dots can run 24/7 in the background, react to new email, calendar
changes, files or webhooks as they arrive, talk to each other when you allow it, and a built-in **SuperDot** asks the right
Dots for you. Built on the open-source [pi agent harness](https://github.com/earendil-works/pi/tree/main/packages/coding-agent).

- **Any model**: cloud (Anthropic, OpenAI, Gemini, xAI/Grok, OpenRouter, Groq, Mistral, DeepSeek, …), on your Mac (Ollama,
  LM Studio, llama.cpp, vLLM, auto-detected) or any OpenAI/Anthropic-compatible URL.
- **Create a Dot from a prompt**: describe what it should do, tick the connectors it may use, and OpenDot generates its name,
  emoji, colour, tagline and personality (streamed live). Templates are just example prompts.
- **Tools**: unlimited MCP servers (local or remote, import your Claude Desktop / Cursor config), Google Workspace, Microsoft 365,
  and Mac capabilities (files, shell, Calendar, Reminders, Contacts, Notes, screenshots, clipboard, notifications).
- **Always on**: watchers for Gmail, Outlook, calendars, Drive, OneDrive, Teams, folders, web pages, RSS, MCP resources, schedules
  and a local webhook. Dots reply with `[URGENT]`, `[UPDATE]` or stay quiet, within budgets you set.
- **SuperDot**: ask anything; it fans out to the right Dots in parallel, streams their answers live, then streams one answer
  with `[Inbox]`-style citations. `@Inbox …` asks one Dot directly.
- **Dot Links (RBAC)**: decide which Dots (or roles) can message which, when (schedules), how often, and whether you approve each message.
- **Private by default**: everything is stored in `~/.opendot` on your Mac. Personal details (emails, phones, cards, keys…) are
  masked before they reach cloud models and restored locally. Tools that change things ask first.
- **Memory**: each Dot remembers durable facts (`remember` / `forget`), plus a shared "About me" every Dot sees.
- **Streaming everywhere**: replies appear from the first token, including background replies and SuperDot fan-outs.

## Install (macOS 14+)

1. Download `OpenDot-<version>-arm64-mac.dmg` (Apple Silicon) or `-x64-mac.dmg` (Intel) from
   [Releases](https://github.com/athulsreekumar/opendot/releases) or from the latest
   [Mac app CI](https://github.com/athulsreekumar/opendot/actions/workflows/desktop-ci.yml) run (artifact **OpenDot-mac**).
   Or build it yourself: see [Build from source](#build-from-source).
2. Open the DMG and drag OpenDot to Applications.
3. The build is **not notarized yet** (no Apple Developer account), so the first launch needs one of:
   - Right-click OpenDot in Applications → **Open** → **Open**, or
   - `xattr -dr com.apple.quarantine /Applications/OpenDot.app`
4. Follow the onboarding: pick a model (paste a key, use Ollama, or a custom URL), pick your first Dots, choose whether Dots keep
   running in the background.

## Where your data lives

Everything is on your Mac in `~/.opendot/`: plain JSON you can read:

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
├─ secrets.bin                     # API keys & OAuth tokens, encrypted with the macOS Keychain
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

## Known limits (v0.1)

- Dots can't run while the Mac is asleep or OpenDot is quit; watchers catch up on wake.
- Gmail/Outlook/Drive are checked every 30 s (no push without a public webhook).
- Not notarized yet; macOS shows a warning on first launch.
- Remote MCP servers that need OAuth sign in the first time a Dot uses them; their tokens are stored by pi in
  `~/.opendot/pi/mcp-auth.json` (mode 600) rather than the Keychain.
- Mac Calendar/Reminders/Contacts/Notes use AppleScript (JXA); macOS asks for permission the first time.

The full design is in [`PLAN.md`](PLAN.md) and [`docs/spec/`](docs/spec/). MIT licensed.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root. Security problems: [SECURITY.md](../SECURITY.md).
