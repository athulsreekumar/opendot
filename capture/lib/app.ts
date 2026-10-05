/// <reference lib="dom" />
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElectronApplication, _electron as electron, type Page } from "playwright-core";
import { APP_DIR, CAPTURE_DIR, SCRIPTS_DIR } from "./paths";

export interface Launched {
	app: ElectronApplication;
	page: Page;
	dataDir: string;
}

export interface LaunchOpts {
	dataDir?: string;
	/** Fake model speed (tokens/s). 45 for recordings, high for seeding. */
	tps?: number;
	/** Chromium device scale factor (2 = retina). */
	scale?: number;
	env?: Record<string, string>;
	/** Extra Chromium flags. */
	args?: string[];
	capture?: boolean;
}

/** Launch the built OpenDot app against a data dir, with the fake provider and capture flags on. */
export async function launch(opts: LaunchOpts = {}): Promise<Launched> {
	const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), "opendot-cap-"));
	const userData = join(dataDir, "_electron");
	mkdirSync(userData, { recursive: true });
	const scale = opts.scale ?? 2;
	const app = await electron.launch({
		executablePath: join(APP_DIR, "node_modules/electron/dist/electron"),
		args: [
			join(CAPTURE_DIR, "lib/main-wrapper.cjs"),
			"--no-sandbox",
			`--force-device-scale-factor=${scale}`,
			"--high-dpi-support=1",
			"--hide-scrollbars",
			...(opts.args ?? []),
		],
		cwd: APP_DIR,
		env: {
			...(process.env as Record<string, string>),
			OPENDOT_DATA_DIR: dataDir,
			OPENDOT_E2E_USERDATA: userData,
			OPENDOT_E2E: "1",
			OPENDOT_FAKE_PROVIDER: "1",
			OPENDOT_CAPTURE: opts.capture === false ? "0" : "1",
			OPENDOT_FAKE_SCRIPTS_DIR: SCRIPTS_DIR,
			OPENDOT_FAKE_TPS: String(opts.tps ?? 45),
			OPENDOT_APP_DIR: APP_DIR,
			...(opts.env ?? {}),
		},
	});
	const page = await app.firstWindow();
	page.on("console", (m) => {
		if (m.type() === "error") console.log("[renderer error]", m.text());
	});
	await page.waitForLoadState("domcontentloaded");
	// tsx/esbuild wraps named functions with __name(); page.evaluate callbacks run in the page, so define it there.
	const font = readFileSync(join(APP_DIR, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")).toString("base64");
	const css = `@font-face{font-family:"Inter Variable";font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${font}) format("woff2")}[data-radix-scroll-area-viewport]~[data-orientation]{display:none!important}`;
	// The app names "Inter Variable" in its font stack but never bundles it; macOS users get SF Pro, so give Linux captures Inter.
	await page.addInitScript(
		`document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)});`,
	);
	await page.evaluate(
		`(()=>{const s=document.createElement("style");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})()`,
	);
	const shim = "window.__name = window.__name || ((f) => f);";
	await page.addInitScript(shim);
	await page.evaluate(shim);
	await page.waitForFunction(() => !!(window as unknown as { opendot?: unknown }).opendot);
	return { app, page, dataDir };
}

/** Copy a seeded data dir to a fresh temp dir so every run starts from the same state. */
export function cloneDataDir(from: string): string {
	const to = mkdtempSync(join(tmpdir(), "opendot-run-"));
	cpSync(from, to, { recursive: true });
	return to;
}

/**
 * Xvfb quirk: a 1440x900 window at 2x leaves the last pixel row/column of the 2880x1800 screen black.
 * Growing the content area by one CSS pixel makes the window cover the whole screen (the extra pixel is clipped).
 * Used for screen recordings only; stills come from the page's own renderer and don't need it.
 */
export async function coverScreen(app: ElectronApplication): Promise<void> {
	await app.evaluate(({ BrowserWindow }) => {
		const w = BrowserWindow.getAllWindows()[0]!;
		w.setMaximumSize(1441, 901);
		w.setContentSize(1441, 901);
	});
}
