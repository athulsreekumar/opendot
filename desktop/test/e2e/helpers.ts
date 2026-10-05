/// <reference lib="dom" />

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type ElectronApplication, _electron as electron, type Page } from "@playwright/test";
import type { OpenDotApi, OpenDotTestApi } from "../../src/shared/ipc";

export interface Launched {
	app: ElectronApplication;
	page: Page;
	dataDir: string;
}

export async function launchApp(
	opts: { script?: string; dataDir?: string; env?: Record<string, string> } = {},
): Promise<Launched> {
	const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), "opendot-e2e-"));
	const userData = join(dataDir, "_electron");
	mkdirSync(userData, { recursive: true });
	const root = resolve(import.meta.dirname, "../..");
	const packaged = process.env.OPENDOT_E2E_EXE;
	const app = await electron.launch({
		...(packaged ? { executablePath: packaged } : {}),
		args: [
			...(packaged ? [] : [join(root, "out/main/index.js")]),
			...(process.platform === "linux" ? ["--no-sandbox"] : []),
		],
		cwd: root,
		env: {
			...(process.env as Record<string, string>),
			OPENDOT_DATA_DIR: dataDir,
			OPENDOT_E2E_USERDATA: userData,
			OPENDOT_FAKE_PROVIDER: "1",
			OPENDOT_E2E: "1",
			OPENDOT_FAKE_TPS: "400",
			...(opts.script ? { OPENDOT_FAKE_SCRIPT: opts.script } : {}),
			...(opts.env ?? {}),
		},
	});
	const page = await app.firstWindow();
	page.on("console", (m) => {
		if (m.type() === "error") console.log("[renderer error]", m.text());
	});
	await page.waitForLoadState("domcontentloaded");
	return { app, page, dataDir };
}

/** Configure the fake model as default and finish onboarding through the API (fast path). */
export async function quickSetup(page: Page): Promise<void> {
	await page.waitForFunction(() => !!window.opendot);
	await page.evaluate(async () => {
		await window.opendot.settings.update({
			defaultModel: { providerId: "opendot-fake", modelId: "fake-1" },
			onboardingDone: true,
		});
	});
	await page.evaluate(() => {
		window.location.hash = "#/chats";
	});
}

export async function screenshot(page: Page, name: string): Promise<void> {
	mkdirSync("e2e-screens", { recursive: true });
	for (const theme of ["light", "dark"] as const) {
		await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
		await page.waitForTimeout(150);
		await page.screenshot({ path: `e2e-screens/${name}-${theme}.png` });
	}
}

declare global {
	interface Window {
		opendot: OpenDotApi;
		opendotTest?: OpenDotTestApi;
	}
}
