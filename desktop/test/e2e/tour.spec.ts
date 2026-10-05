// Screenshot tour of the main screens (visual QA; also catches render crashes).
import { expect, test } from "@playwright/test";
import { launchApp, quickSetup, screenshot } from "./helpers";

test("screen tour renders without errors", async () => {
	const { app, page } = await launchApp();
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	try {
		await quickSetup(page);
		const t = (await page.evaluate(() => window.opendot.dots.templates())).find((x) => x.id === "inbox")!;
		const id = await page.evaluate(
			async (draft) => (await window.opendot.dots.create({ draft, creationPrompt: "Watch my inbox" })).id,
			t.draft,
		);
		for (const [hash, name] of [
			["#/settings/models", "settings-models"],
			["#/settings/privacy", "settings-privacy"],
			["#/settings/about-me", "settings-about-me"],
			["#/settings/background", "settings-background"],
			["#/connections", "connections"],
			[`#/chats/${id}`, "chat-inbox"],
		] as const) {
			await page.evaluate((h) => {
				window.location.hash = h;
			}, hash);
			await page.waitForTimeout(700);
			await screenshot(page, name);
		}
		await page
			.getByRole("button", { name: /dot info|info/i })
			.first()
			.click();
		await page.waitForTimeout(700);
		await screenshot(page, "dot-info");
		await page.evaluate(() => {
			window.location.hash = "#/connections";
		});
		await page.getByRole("tab", { name: /catalog/i }).click();
		await page.waitForTimeout(500);
		await screenshot(page, "connections-catalog");
		expect(errors).toEqual([]);
	} finally {
		await app.close();
	}
});

test("This Mac lists its built-in tools", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const mac = (await page.evaluate(() => window.opendot.connections.list())).find((c) => c.type === "mac")!;
		await page.evaluate((id) => {
			window.location.hash = `#/connections/${id}`;
		}, mac.id);
		await expect(page.getByText("mac_calendar_events")).toBeVisible({ timeout: 15000 });
		await expect(page.getByText("bash", { exact: true })).toBeVisible();
		await expect(page.getByText(/^\d+ tools$/)).not.toHaveText("0 tools");
		await screenshot(page, "connection-this-mac");
	} finally {
		await app.close();
	}
});
