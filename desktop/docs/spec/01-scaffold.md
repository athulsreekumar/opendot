# Spec 01 — Scaffold, dependencies, configuration

All paths are relative to `opendot/`.

## 1. Requirements

- Node **22.19+** on the dev machine (`node -v`). npm 10+.
- macOS for `dev`/`dist:mac`. Linux works for `typecheck`, `lint`, `test`, and `build`.

## 2. Folder tree (final shape — create folders lazily as tasks need them)

```
opendot/
├─ PLAN.md
├─ README.md
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ tsconfig.json              # references node + web
├─ tsconfig.node.json         # main + preload + shared + tests of main
├─ tsconfig.web.json          # renderer + shared
├─ biome.json
├─ vitest.config.ts
├─ playwright.config.ts
├─ build/
│  ├─ entitlements.mac.plist
│  └─ icon.icns               # T50 (placeholder until then)
├─ scripts/
│  └─ check-node-version.mjs
├─ docs/spec/…                # this plan
├─ test/
│  ├─ fixtures/               # fake provider scripts, MCP echo server, recorded API shapes
│  └─ e2e/                    # Playwright specs: <TASK-ID>.spec.ts
└─ src/
   ├─ shared/                 # pure TS, no node/electron/dom imports
   │  ├─ types.ts  ipc.ts  defaults.ts  ids.ts  schemas.ts
   ├─ main/
   │  ├─ index.ts  services.ts  window.ts  paths.ts  log.ts
   │  ├─ ipc/ register.ts  handlers/{app,dots,chat,models,connections,approvals,links,settings,audit,pii}.ts
   │  ├─ store/ json-file.ts  store.ts
   │  ├─ security/ secret-store.ts  policy-engine.ts  approval-broker.ts
   │  ├─ models/ model-service.ts  provider-presets.ts  discovery.ts  fake-provider.ts
   │  ├─ runtime/ pi-adapter.ts  dot-host.ts  dot-runtime.ts  system-prompt.ts  event-mapper.ts
   │  │  └─ extensions/ policy.ts  pii.ts  links.ts  mcp.ts  native-tools.ts
   │  ├─ connections/ connection-service.ts  catalog.ts  catalog/*.json  mcp-status.ts
   │  │  ├─ mac/…  google/…  microsoft/…
   │  ├─ oauth/ loopback.ts  pkce.ts  token-store.ts
   │  ├─ pii/ detectors.ts  vault.ts  pii-service.ts
   │  ├─ links/ link-policy.ts  schedule.ts  link-bus.ts
   │  └─ dots/ dot-service.ts  persona.ts  dot-architect.ts  templates/*.json
   ├─ preload/
   │  └─ index.ts
   └─ renderer/
      ├─ index.html
      └─ src/
         ├─ main.tsx  App.tsx  styles.css  env.d.ts
         ├─ design-system/ tokens.css  theme.ts  components/*.tsx  icons.ts
         ├─ app/ AppShell.tsx  NavRail.tsx  ListPane.tsx  MainPane.tsx  RightDrawer.tsx  router.ts  ApprovalsTray.tsx
         ├─ stores/ ui.ts  dots.ts  chat.ts  settings.ts  approvals.ts  connections.ts  links.ts
         ├─ lib/ api.ts  format.ts
         └─ features/ chats/  dot-info/  new-dot/  connections/  links/  settings/  onboarding/  gallery/
```

## 3. Pinned dependencies (exact versions — do not use ^ or ~)

Verified compatible set (Oct 2026). `electron-vite@5` supports `vite@^7` (not 8), which is why
`vite` and `@vitejs/plugin-react` are held back one major.

**dependencies** (runtime, bundled into the app)

| Package | Version | Used for |
|---|---|---|
| `@earendil-works/pi-coding-agent` | `1.0.2` | Agent harness (SDK) |
| `@earendil-works/pi-ai` | `1.0.2` | `Type`, `StringEnum`, model types, `fauxProvider` |
| `@earendil-works/pi-mcp` | `1.0.2` | Standalone MCP client for "Test connection" |
| `typebox` | `1.3.27` | Same version pi uses — tool schemas |
| `zod` | `4.6.5` | IPC/store validation |
| `nanoid` | `6.0.1` | IDs |
| `write-file-atomic` | `8.0.0` | Atomic JSON writes |
| `libphonenumber-js` | `1.13.14` | PII phones |
| `compromise` | `14.17.0` | PII person names (optional detector) |
| `fix-path` | `5.0.0` | Load shell PATH in GUI app |
| `electron-log` | `5.4.4` | Logging |
| `react`, `react-dom` | `19.3.0` | UI |
| `zustand` | `5.0.15` | State |
| `@radix-ui/react-dialog` | `1.1.23` | |
| `@radix-ui/react-dropdown-menu` | `2.1.24` | |
| `@radix-ui/react-tooltip` | `1.2.16` | |
| `@radix-ui/react-switch` | `1.3.7` | |
| `@radix-ui/react-tabs` | `1.1.21` | |
| `@radix-ui/react-popover` | `1.1.23` | |
| `@radix-ui/react-slider` | `1.4.7` | |
| `@radix-ui/react-select` | `2.3.7` | |
| `@radix-ui/react-scroll-area` | `1.2.18` | |
| `lucide-react` | `1.52.0` | Icons |
| `motion` | `14.0.0` | Animation (`import { motion } from "motion/react"`) |
| `react-markdown` | `10.1.0` | Message markdown |
| `remark-gfm` | `4.0.1` | Tables, task lists |
| `rehype-highlight` | `7.0.2` | Code highlighting |
| `react-virtuoso` | `4.18.16` | Virtualised message list + dot list |
| `clsx` | `2.1.1` | |
| `class-variance-authority` | `0.7.1` | Variants |
| `date-fns` | `4.4.0` | Times ("10:42", "Yesterday") |
| `@fontsource-variable/inter` | `5.3.0` | Fallback font (system font first) |

**devDependencies**

| Package | Version |
|---|---|
| `electron` | `44.5.1` |
| `electron-vite` | `5.0.0` |
| `electron-builder` | `26.15.3` |
| `vite` | `7.3.6` |
| `@vitejs/plugin-react` | `5.2.0` |
| `tailwindcss` | `4.3.3` |
| `@tailwindcss/vite` | `4.3.3` |
| `typescript` | `5.9.3` |
| `vitest` | `4.1.11` |
| `@testing-library/react` | `16.3.3` |
| `jsdom` | `30.1.2` |
| `@playwright/test` | `1.63.0` |
| `@biomejs/biome` | `2.5.15` |
| `@types/node` | `22.x latest` (exact pin at install time) |
| `@types/react`, `@types/react-dom` | matching 19.x (exact pin at install time) |
| `@types/write-file-atomic` | latest (exact pin at install time) |

If `npm install` reports a peer conflict, **stop and report** — do not use `--force` or `--legacy-peer-deps`.

## 4. Config files (verbatim)

### 4.1 `package.json`

```json
{
  "name": "opendot",
  "productName": "OpenDot",
  "version": "0.1.0",
  "description": "Open-source team of AI agents (Dots) for your Mac, built on pi.",
  "license": "MIT",
  "type": "module",
  "main": "./out/main/index.js",
  "engines": { "node": ">=22.19.0" },
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit",
    "lint": "biome check .",
    "format": "biome check --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "npm run build && playwright test",
    "dist:mac": "npm run build && electron-builder --mac --arm64 --x64 --publish never",
    "postinstall": "node scripts/check-node-version.mjs"
  }
}
```
(Dependencies are added by `npm install --save-exact <pkg>@<ver>` so `package.json` and the
lockfile agree.)

### 4.2 `electron.vite.config.ts`

```ts
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    // Keep pi and every runtime dep external: they load from node_modules at runtime
    // (pi spawns workers and reads wasm/assets relative to its own files).
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared") } },
    build: {
      rollupOptions: {
        input: { index: resolve("src/main/index.ts") },
        output: { format: "es", entryFileNames: "[name].js" },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared") } },
    build: {
      rollupOptions: {
        input: { index: resolve("src/preload/index.ts") },
        // Sandboxed preloads must be CommonJS.
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer/src") },
    },
    build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
  },
});
```

### 4.3 TypeScript

`tsconfig.json`
```json
{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }] }
```

`tsconfig.node.json`
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "types": ["node", "electron-vite/node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "composite": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "test/**/*", "electron.vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

`tsconfig.web.json`
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "composite": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"], "@/*": ["src/renderer/src/*"] }
  },
  "include": ["src/renderer/src/**/*", "src/shared/**/*"]
}
```

### 4.4 `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "files": { "includes": ["src/**", "test/**", "scripts/**", "*.ts", "*.json", "!out", "!release", "!node_modules"] },
  "formatter": { "indentStyle": "tab", "lineWidth": 120 },
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "warn", "noConsole": { "level": "error", "options": { "allow": ["error", "warn"] } } },
      "style": { "noNonNullAssertion": "warn" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "double", "semicolons": "always" } }
}
```

### 4.5 `vitest.config.ts`

```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer/src") } },
  test: {
    passWithNoTests: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/unit/**/*.test.ts"],
    environment: "node",
    environmentMatchGlobs: [["src/renderer/**", "jsdom"]],
    testTimeout: 15000,
  },
});
```
> If the installed vitest version removed `environmentMatchGlobs`, use a `// @vitest-environment jsdom`
> docblock at the top of every renderer test instead, and delete that key.

### 4.6 `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  retries: 0,
  use: { screenshot: "only-on-failure", trace: "retain-on-failure" },
  outputDir: "test-results",
});
```
E2E specs launch with `_electron.launch({ args: ["out/main/index.js"], env: { ...process.env,
OPENDOT_DATA_DIR: <tmp>, OPENDOT_FAKE_PROVIDER: "1", OPENDOT_E2E: "1" } })`. Helper:
`test/e2e/helpers.ts` (`launchApp()`, `seedDots(n)`, `screenshot(name)`), created in T08.

### 4.7 `.gitignore`

```
node_modules/
out/
release/
test-results/
playwright-report/
*.log
.DS_Store
```

### 4.8 `build/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.automation.apple-events</key><true/>
  <key>com.apple.security.device.audio-input</key><true/>
  <key>com.apple.security.personal-information.calendars</key><true/>
  <key>com.apple.security.personal-information.addressbook</key><true/>
</dict></plist>
```

### 4.9 `scripts/check-node-version.mjs`

```js
// Fails install if Electron's bundled Node cannot run pi (needs >= 22.19).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let electronPath;
try { electronPath = require("electron"); } catch { console.log("ok (electron not installed yet)"); process.exit(0); }
const v = execFileSync(electronPath, ["-e", "process.stdout.write(process.versions.node)"], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
}).toString().trim();
const [maj, min] = v.split(".").map(Number);
if (maj > 22 || (maj === 22 && min >= 19)) { console.log("ok", v); }
else { console.error(`Electron bundles Node ${v}; pi needs >= 22.19`); process.exit(1); }
```
(On headless Linux CI this may need `xvfb-run`; if electron cannot start, print a warning and exit 0.)

### 4.10 `electron-builder.yml` — see spec 11 §4 (created in T01 with that content).

## 5. Hello-world entry files (T01)

`src/main/index.ts` (replaced in T10)
```ts
import { join } from "node:path";
import { app, BrowserWindow } from "electron";

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600, title: "OpenDot",
    titleBarStyle: "hiddenInset",
    webPreferences: { preload: join(import.meta.dirname, "../preload/index.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
```

`src/renderer/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'" />
    <title>OpenDot</title>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```
(In dev, electron-vite injects its HMR client. If the CSP blocks it, relax `script-src` and
`connect-src` **only** when `import.meta.env.DEV` by setting the CSP header from main via
`session.defaultSession.webRequest.onHeadersReceived`, and drop the meta tag. Document the choice in a comment.)

`src/renderer/src/main.tsx`
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
createRoot(document.getElementById("root") as HTMLElement).render(<StrictMode><App /></StrictMode>);
```
`src/renderer/src/App.tsx`: `export function App() { return <h1>Hello OpenDot</h1>; }`
`src/renderer/src/styles.css`: `@import "tailwindcss";` (T05 extends it)
`src/preload/index.ts`: `export {};` (T03 replaces it)

## 6. Secure window defaults (T10)

```ts
new BrowserWindow({
  width: 1280, height: 820, minWidth: 900, minHeight: 600,
  title: "OpenDot", show: false, backgroundColor: "#00000000",
  titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 18 },
  vibrancy: "sidebar", visualEffectState: "active",
  webPreferences: {
    preload: join(import.meta.dirname, "../preload/index.cjs"),
    contextIsolation: true, sandbox: true, nodeIntegration: false,
    webSecurity: true, spellcheck: true,
  },
});
```
- `win.once("ready-to-show", () => win.show())`.
- `setWindowOpenHandler` → `shell.openExternal(url)` for `https:` / `mailto:` only; deny everything else.
- `will-navigate` → `preventDefault()` unless the URL is the app's own.
- Persist window bounds in `settings.window` (debounced 500 ms).
- `app.requestSingleInstanceLock()`; on `second-instance` restore and focus.
- Before services start: `import fixPath from "fix-path"; fixPath();`
