/// <reference lib="dom" />
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "playwright-core";

export const row = (page: Page, name: string): Locator => page.locator("button.od-no-drag").filter({ hasText: name }).first();
export const composer = (page: Page): Locator => page.locator("textarea").last();

/** Mark every non-super Dot as archived so it can be "added" on camera by un-archiving. */
export function archiveAllButSuper(dataDir: string, except: string[] = []): void {
	const dots = join(dataDir, "dots");
	for (const id of readdirSync(dots)) {
		const f = join(dots, id, "dot.json");
		const j = JSON.parse(readFileSync(f, "utf8"));
		if (j.data.kind === "super" || except.includes(j.data.name)) continue;
		j.data.archived = true;
		writeFileSync(f, `${JSON.stringify(j, null, 2)}\n`);
	}
}

export async function waitText(page: Page, text: string, timeout = 90000): Promise<void> {
	await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout, polling: 100 });
}
