# Spec 11 — Testing, packaging, CI, release

## 1. Test pyramid

| Layer | Tool | Where | What |
|---|---|---|---|
| Unit | Vitest (node) | `src/main/**/*.test.ts`, `src/shared/**/*.test.ts` | store, policy, PII, links, persona compiler, model discovery (mock fetch), OAuth helpers |
| Integration | Vitest (node) | `src/main/runtime/**/*.test.ts` | real pi `AgentSession` + fake provider + echo MCP fixture; temp data dir |
| Component | Vitest (jsdom) + Testing Library | `src/renderer/**/*.test.tsx` | design-system a11y, stores reducing events |
| E2E | Playwright `_electron` | `test/e2e/<TASK>.spec.ts` | golden paths, screenshots light+dark |

Electron mocking in unit tests: `vi.mock("electron", () => ({ app: { getPath: () => tmp, getVersion: () => "0.0.0-test", getLocaleCountryCode: () => "US" },
safeStorage: { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from("enc:" + s), decryptString: (b) => b.toString().slice(4) },
shell: { openExternal: vi.fn() }, systemPreferences: {...}, desktopCapturer: {...}, clipboard: {...}, Notification: class {} }))`. Put it in `test/unit/electron-mock.ts` (T11).

Rules: no network in tests (`fetch` is stubbed; the test fails on an unstubbed call), no real API keys, a temp `OPENDOT_DATA_DIR` per test file,
and fake timers for idle/expiry logic.

## 2. Fake provider
Spec 04 §6. Fixture scripts needed (create them as the tasks need them):
`hello.json` (one text reply), `stream-long.json` (≈ 600 words with markdown + a code block), `tool-echo.json` (calls `mcp__echo__echo`, then answers),
`tool-destructive.json` (calls `mcp__echo__delete_everything`), `pii-capture.json` (`$capture` then "ok"), `link-ask.json` (calls `message_dot` to "Calendar"),
`link-reply.json` (the target's answer), `event-update.json` ("[UPDATE] …"), `event-quiet.json` ("NO_UPDATE"), `event-urgent.json`, `super-fanout.json` (an `ask_dots` call then a synthesis citing [Inbox] and [Calendar]), `error-401.json` (an assistant message with `stopReason: "error"`, `errorMessage: "401 Unauthorized"`).

## 3. E2E

### 3.1 Harness (`test/e2e/helpers.ts`)
```ts
export async function launchApp(opts?: { script?: string; seed?: "empty" | "three-dots" }): Promise<{ app: ElectronApplication; page: Page; dataDir: string }>;
```
- Creates a temp dataDir. Seeding writes `data/*.json` directly before launch (`three-dots`: Dot, Inbox, Calendar with the fake model as default, `onboardingDone: true`).
- Env: `OPENDOT_DATA_DIR`, `OPENDOT_FAKE_PROVIDER=1`, `OPENDOT_FAKE_SCRIPT`, `OPENDOT_E2E=1`.
- `screenshot(page, name)` saves to `test-results/screens/<name>-<theme>.png` for both themes (toggles `data-theme` via `page.evaluate`).

### 3.2 Golden path (T49) — `golden.spec.ts`
1. Fresh launch → onboarding → "Use a model on this Mac" is skipped via "Skip for now" → pick templates Dot + Inbox → Start.
2. Settings → Models: the fake provider appears as "Fake (tests)" (registered as a cloud-like provider in E2E) → set it as default.
3. Open Dot → send "hello" → the streamed reply appears → the list preview updates.
4. Connections → Add MCP server (local) → command = `process.execPath` + echo fixture, env `ELECTRON_RUN_AS_NODE=1` → Test shows 2 tools → Install.
5. Dot Info → Tools → allow "echo" connection → send "use echo" (script `tool-echo`) → the tool chip completes.
6. Script `tool-destructive` → an approval card appears → Deny → the Dot replies that it was declined.
7. Dot Links → rule Dot → Inbox (ask) → in Dot, script `link-ask` → the link approval → Allow → the link card shows the reply.
8. Privacy: the PII capture script with a message containing an email → assert via `test.getCaptured` IPC (E2E only) that the captured context has `⟦EMAIL_1⟧` and not the email.
9. Restart the app (same dataDir) → history persists, the settings persist, and the unread counts are correct.
10. **Always on:** enable it on Inbox, add a `local-webhook` watcher, POST an event with `fetch` from the test → the event card appears in ≤ 1 s, the reply
    (script `event-update`, which starts with `[UPDATE]`) streams in; script `event-quiet` (`NO_UPDATE`) → "Handled quietly", no unread increment.
11. **Background:** close the window (`win.close()` via `app.evaluate`) → POST another event → reopen via `app.evaluate(() => showWindow())` → the reply is there and the tray tooltip shows 1 update.
12. **SuperBot:** in Super, script `super-fanout` calls `ask_dots` for Inbox + Calendar (their link scripts reply) → the fan-out card shows 2 rows streaming, then the synthesis
    with `[Inbox]` citation chips. `@Inbox what's new` → the direct path streams Inbox's reply.
13. **Streaming budget:** the spec 14 §5 assertions on `stream-long` (10k chars).

### 3.3 Soak test (T68) — `soak.spec.ts` (nightly CI job, not on PRs)
With the fake provider and a fake-clock-free real run of 20 minutes: 5 always-on Dots, each with a `schedule` watcher every minute (min interval lowered via
`OPENDOT_E2E_MIN_INTERVAL=5`) and a local webhook hammered at 1 req/s. Assert: no unhandled rejections in `main.log`, main RSS < 600 MB, the event-to-delivery
p95 is < 2 s outside batching, the budget limits trip and recover as specified, and watchers back off and recover when the webhook fixture returns errors.

## 4. Packaging (`electron-builder.yml`, created in T01, finalised in T50)

```yaml
appId: dev.opendot.app
productName: OpenDot
copyright: Copyright © 2026 OpenDot contributors
directories:
  output: release
  buildResources: build
files:
  - out/**
  - package.json
  - "!**/*.map"
asar: true
asarUnpack:
  # pi loads workers, wasm and assets relative to its own files; keep them on disk.
  - node_modules/@earendil-works/**
  - node_modules/@silvia-odwyer/photon-node/**
  - "**/*.node"
mac:
  target:
    - target: dmg
      arch: [arm64, x64]
    - target: zip
      arch: [arm64, x64]
  category: public.app-category.productivity
  icon: build/icon.icns
  identity: "-"            # ad-hoc signing (no Apple Developer account yet). Replace with "Developer ID Application: …" later.
  hardenedRuntime: false   # enable together with real signing + notarization
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  extendInfo:
    NSAppleEventsUsageDescription: OpenDot lets your Dots use Calendar, Reminders, Contacts and Notes only when you allow it.
    NSCalendarsUsageDescription: OpenDot lets your Dots read and add calendar events only when you allow it.
    NSCalendarsFullAccessUsageDescription: OpenDot lets your Dots read and add calendar events only when you allow it.
    NSRemindersUsageDescription: OpenDot lets your Dots read and add reminders only when you allow it.
    NSRemindersFullAccessUsageDescription: OpenDot lets your Dots read and add reminders only when you allow it.
    NSContactsUsageDescription: OpenDot lets your Dots look up contacts only when you allow it.
    NSMicrophoneUsageDescription: OpenDot uses the microphone only for voice messages you record.
dmg:
  title: OpenDot ${version}
  artifactName: OpenDot-${version}-${arch}.dmg
zip:
  artifactName: OpenDot-${version}-${arch}-mac.zip
npmRebuild: false   # no native modules (decision D4)
publish:
  provider: github
  owner: athulsreekumar
  repo: claude-code-remote
  releaseType: release
```
- `identity: "-"`: verify that electron-builder 26 accepts ad-hoc signing with `"-"`. If not, use `identity: null` plus a `afterSign` hook
  running `codesign --force --deep --sign - <app>` (Apple Silicon refuses to run completely unsigned arm64 code).
- Smoke test (T50, on macOS): `open release/mac-arm64/OpenDot.app`, then create a Dot with Ollama (if available) or the fake provider
  (`OPENDOT_FAKE_PROVIDER=1 release/mac-arm64/OpenDot.app/Contents/MacOS/OpenDot`), use a codemode tool once (proves the worker loads outside asar), and attach an image
  (proves photon wasm loads).
- First-run instructions for unsigned builds (README): right-click → Open → Open, or `xattr -dr com.apple.quarantine /Applications/OpenDot.app`.

## 5. CI (`.github/workflows/`, T51 — at the repo root, scoped to `opendot/**`)

`opendot-ci.yml`
```yaml
name: OpenDot CI
on:
  pull_request: { paths: ["opendot/**", ".github/workflows/opendot-*.yml"] }
  push: { branches: [main], paths: ["opendot/**"] }
jobs:
  check:
    runs-on: macos-14
    defaults: { run: { working-directory: opendot } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: opendot/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: test-results, path: opendot/test-results }
```
`opendot-release.yml`
```yaml
name: OpenDot Release
on: { push: { tags: ["opendot-v*"] } }
permissions: { contents: write }
jobs:
  release:
    runs-on: macos-14
    defaults: { run: { working-directory: opendot } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: opendot/package-lock.json }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx electron-builder --mac --arm64 --x64 --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Notarization (disabled until an Apple Developer account exists):
          # APPLE_ID: ${{ secrets.APPLE_ID }}
          # APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          # APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # CSC_LINK / CSC_KEY_PASSWORD for the Developer ID certificate
```
Version source of truth: `opendot/package.json` `version`. The tag must equal `opendot-v<version>` (a script step fails otherwise).

## 6. Definition of Done (the whole project, v1.0)
- [ ] All tasks T01–T52 `done` on the board
- [ ] Golden path e2e green on macOS CI
- [ ] DMGs downloadable from a GitHub Release, launching on a clean macOS 14+ machine (arm64 + x64)
- [ ] No secrets on disk in plaintext except MCP OAuth tokens in `pi/mcp-auth.json` (documented, 0600)
- [ ] README: install, first run, privacy model, BYO Google/Microsoft client IDs, adding MCP servers, building from source
