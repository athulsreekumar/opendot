# Contributing to OpenDot

Thanks for wanting to make OpenDot better. Bug reports, ideas, docs fixes, new Dot templates, connectors and code
are all welcome, and you don't need to ask before opening an issue or a small pull request.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug** with the [bug report form](https://github.com/athulsreekumar/opendot/issues/new?template=bug_report.yml).
- **Suggest a feature** with the [feature request form](https://github.com/athulsreekumar/opendot/issues/new?template=feature_request.yml).
- **Pick up an issue** labelled [`good first issue`](https://github.com/athulsreekumar/opendot/labels/good%20first%20issue)
  or [`help wanted`](https://github.com/athulsreekumar/opendot/labels/help%20wanted). Comment that you're on it so nobody
  duplicates the work.
- **Improve the docs**: the [README](README.md), [`desktop/README.md`](desktop/README.md) and the guides on the website.
- **Share a Dot template** or an MCP server that works well with OpenDot.
- **Found a security problem?** Please don't open an issue. Follow [SECURITY.md](SECURITY.md) instead.

## What's in this repository

| Path | What it is | Stack |
|---|---|---|
| [`desktop/`](desktop/) | The OpenDot app for Mac and Windows | Electron, React 19, Tailwind v4, Zustand, [pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) |
| `app/`, `components/`, `lib/`, `styles/`, `public/` | The [opendot.live](https://opendot.live) website | Next.js 16, Tailwind v4, GSAP, three.js |
| `capture/` | Scripts that drive the app with dummy data to take screenshots | Playwright |
| `docs/` | Website docs, SEO notes | Markdown |

The app's design and specs live in [`desktop/PLAN.md`](desktop/PLAN.md) and [`desktop/docs/spec/`](desktop/docs/spec/).
Read the spec for the area you're changing before you start; it explains why things are the way they are.

## Set up

You need **macOS 14 or later** or **Windows 10/11** for the app (the website works on any OS), **Node.js 22.19+** and **Git**.

```bash
git clone https://github.com/athulsreekumar/opendot.git
cd opendot
```

### The app

```bash
cd desktop
npm ci
npm run dev                         # the app with hot reload
OPENDOT_FAKE_PROVIDER=1 npm run dev # a scripted test model, no API key needed
OPENDOT_DATA_DIR=/tmp/opendot-dev npm run dev   # keep your real ~/.opendot untouched
```

### The website

```bash
npm ci                     # in the repository root
cp .env.example .env.local
RESEND_MOCK=1 npm run dev  # http://localhost:3000
```

## Before you open a pull request

Run the checks for the part you changed. CI runs the same ones on every pull request.

**App** (`desktop/`):

```bash
npm run typecheck && npm run lint && npm test
npm run e2e        # builds, then drives the real app with a scripted model
```

**Website** (repository root):

```bash
npm run lint && npm run typecheck && npm test
npm run build && npm run e2e
```

On Linux, run the app's end-to-end tests under a virtual display: `xvfb-run -a npm run e2e`.

### Add tests

- A bug fix comes with a test that fails without the fix.
- New behaviour comes with unit tests (Vitest): next to the code as `*.test.ts` in the app, in `tests/unit/` for the website.
- Anything a user clicks through gets an end-to-end test (`desktop/test/e2e/` or `tests/e2e/`). The app's tests use the
  scripted fake model, so they never need a real API key or network.

## Code style

- **Formatting and lint**: [Biome](https://biomejs.dev). Tabs, double quotes, 120-character lines. Run `npm run format`
  to fix most things automatically.
- **TypeScript** everywhere, `strict` on. Avoid `any`; if you must cast, leave a comment saying why.
- **Comments** explain why, not what. Match the density of the surrounding code.
- **Copy**: website text lives in `lib/copy.ts` and `lib/pages.ts`. Write short, plain sentences. We don't use em dashes
  in user-facing text; use a comma, colon or full stop instead.
- **Privacy first**: never log message contents, API keys or personal data. Anything a Dot can do that changes the
  world (send, delete, pay, run a command) must go through the approval flow.
- **Dependencies**: keep them few. Explain any new dependency in the pull request.

## Commits and pull requests

- Keep each pull request focused on one change. Small pull requests get reviewed faster.
- Start the commit subject with the area: `App: …`, `Website: …`, `Docs: …`, `CI: …`. Use the imperative mood
  ("Add Outlook watcher", not "Added").
- Fill in the pull request template: what changed, why, how you tested it, and screenshots for anything visual.
- Link the issue it closes (`Closes #123`).
- A maintainer reviews it, may ask for changes, and merges it once CI is green.

## Releases

Maintainers tag releases as `vX.Y.Z` (matching `desktop/package.json`). The **Desktop app release** workflow builds DMGs
for Apple silicon and Intel plus a Windows installer, and publishes them on [GitHub Releases](https://github.com/athulsreekumar/opendot/releases).
Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Questions

Ask in [GitHub Discussions](https://github.com/athulsreekumar/opendot/discussions) or open an issue. See
[SUPPORT.md](SUPPORT.md) for where to go for what.

## License

OpenDot is [MIT-licensed](LICENSE). By contributing, you agree that your contributions are licensed under the same
license.
