/// <reference lib="dom" />
import type { Page } from "playwright-core";

export type Theme = "light" | "dark";

export async function setTheme(page: Page, theme: Theme): Promise<void> {
	await page.evaluate((t) => window.opendot.settings.update({ theme: t }), theme);
	await page.waitForFunction((t) => document.documentElement.getAttribute("data-theme") === t, theme);
}

/** Connections start "Disconnected" until checked; ask the app to check them all (as it does in normal use). */
export async function warmConnections(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const list = await window.opendot.connections.list();
		await Promise.all(list.map((c) => window.opendot.connections.check(c.id).catch(() => undefined)));
	});
}

export async function dotIdByName(page: Page, name: string): Promise<string> {
	const id = await page.evaluate(async (n) => (await window.opendot.dots.list()).find((d) => d.name === n)?.id, name);
	if (!id) throw new Error(`No Dot named ${name}`);
	return id;
}

export async function go(page: Page, hash: string, settleMs = 700): Promise<void> {
	await page.evaluate((h) => {
		window.location.hash = h;
	}, hash);
	await page.waitForTimeout(settleMs);
}

export async function openDot(page: Page, name: string): Promise<string> {
	const id = await dotIdByName(page, name);
	await go(page, `#/chats/${id}`, 900);
	await page.locator("textarea").last().waitFor();
	return id;
}

export async function blurFocus(page: Page): Promise<void> {
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
}

export async function waitForText(page: Page, text: string | RegExp, timeout = 60000): Promise<void> {
	const src = typeof text === "string" ? text : text.source;
	const isRe = typeof text !== "string";
	await page.waitForFunction(
		({ src, isRe }) => (isRe ? new RegExp(src).test(document.body.innerText) : document.body.innerText.includes(src)),
		{ src, isRe },
		{ timeout, polling: 100 },
	);
}

export async function sendMessage(page: Page, text: string): Promise<void> {
	const box = page.locator("textarea").last();
	await box.fill(text);
	await box.press("Enter");
}

/** Light the whole window up once fonts and layout have settled. */
export async function settle(page: Page, ms = 500): Promise<void> {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(ms);
}

/**
 * Keep the open chat scrolled to the bottom while a reply streams in (smoothly, one line at a time).
 * The app only follows when a new message is appended, not while one grows; this stands in for a reader
 * who keeps their eyes on the latest line. Installed once per page.
 */
export async function followChat(page: Page): Promise<void> {
	await page.evaluate(() => {
		const w = window as unknown as { __follow?: boolean };
		if (w.__follow) return;
		w.__follow = true;
		const loop = () => {
			const el = document.querySelector('.od-chat-wallpaper [data-virtuoso-scroller="true"]') as HTMLElement | null;
			if (el) {
				const d = el.scrollHeight - el.clientHeight - el.scrollTop;
				if (d > 1) el.scrollTop += Math.max(1, d * 0.18);
			}
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	});
}
