// Screenshot tour of the main screens (visual QA; also catches render crashes).
import { expect, test } from "@playwright/test";
import { launchApp, quickSetup, screenshot } from "./helpers";

test("screen tour renders without errors", async () => {
	const { app, page } = await launchApp();
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	// The Organisation screens must show their error or empty state quietly (no console errors).
	let onOrganisation = false;
	const orgConsoleErrors: string[] = [];
	page.on("console", (m) => {
		if (onOrganisation && m.type() === "error") orgConsoleErrors.push(m.text());
	});
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
			["#/organisation", "organisation"],
			["#/organisation/team", "organisation-team"],
			["#/organisation/skills", "organisation-skills"],
			[`#/chats/${id}`, "chat-inbox"],
		] as const) {
			onOrganisation = hash.startsWith("#/organisation");
			await page.evaluate((h) => {
				window.location.hash = h;
			}, hash);
			await page.waitForTimeout(700);
			await screenshot(page, name);
		}
		onOrganisation = false;
		expect(orgConsoleErrors).toEqual([]);
		await page
			.getByRole("button", { name: /dot info|info/i })
			.first()
			.click();
		await page.waitForTimeout(700);
		await screenshot(page, "dot-info");
		await page.getByRole("button", { name: /change icon/i }).click();
		await page.getByLabel("Search icons").fill("triage");
		await screenshot(page, "dot-info-icon-picker");
		await page.getByRole("option", { name: "Inbox" }).click();
		await expect
			.poll(async () => (await page.evaluate((id) => window.opendot.dots.get(id), id)).appearance.icon)
			.toBe("inbox");
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

test("This Mac (This PC on Windows) lists its built-in tools", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const mac = (await page.evaluate(() => window.opendot.connections.list())).find((c) => c.type === "mac")!;
		await page.evaluate((id) => {
			window.location.hash = `#/connections/${id}`;
		}, mac.id);
		const win = process.platform === "win32";
		await expect(page.getByText(win ? "mac_screenshot" : "mac_calendar_events")).toBeVisible({ timeout: 15000 });
		if (win) await expect(page.getByText("mac_calendar_events")).toHaveCount(0);
		// On Windows without Git for Windows the shell tool is hidden and a note explains why.
		const shell = await page.evaluate(async () => (await window.opendot.app.info()).shellAvailable);
		if (shell) await expect(page.getByText("bash", { exact: true })).toBeVisible();
		else await expect(page.getByTestId("shell-note")).toBeVisible();
		await expect(page.getByText(/^\d+ tools$/)).not.toHaveText("0 tools");
		await screenshot(page, "connection-this-mac");
	} finally {
		await app.close();
	}
});
