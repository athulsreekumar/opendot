// Scene 8: your data stays home. Personal details are masked before a cloud model sees them.
import { recordScene } from "../lib/scene";
import { go } from "../lib/ui";

await recordScene({
	name: "s8-privacy",
	setup: async ({ page }) => {
		await go(page, "#/settings/privacy", 1000);
		await page.evaluate(() => {
			const ta = document.querySelector("textarea");
			ta?.scrollIntoView({ block: "center" });
		});
		await page.waitForTimeout(400);
	},
	run: async (c) => {
		const { page, cursor } = c;
		const ta = page.locator("textarea").first();
		await cursor.click(ta, 900);
		await page.keyboard.press("Control+a");
		await page.keyboard.press("Backspace");
		await c.pause(400);
		c.mark("typing");
		await c.type("Email maya.chen@example.com or call +1 415-555-0134. Card 4111 1111 1111 1111.");
		c.mark("masked");
		await cursor.moveTo(1500, 760, 900);
		await c.pause(2200);
	},
});
