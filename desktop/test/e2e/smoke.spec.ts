import { expect, test } from "@playwright/test";
import { launchApp, quickSetup, screenshot } from "./helpers";

test("app boots, shows SuperDot, chats with streaming", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		await expect(page.getByText("SuperDot").first()).toBeVisible({ timeout: 20000 });
		await screenshot(page, "smoke-list");
		await page.getByText("SuperDot").first().click();
		const box = page.locator("textarea").last();
		await box.fill("hello there");
		await box.press("Enter");
		await expect(page.getByText("You said: hello there").first()).toBeVisible({ timeout: 20000 });
		await screenshot(page, "smoke-chat");
	} finally {
		await app.close();
	}
});
