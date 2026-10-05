// Scene 6: nothing happens without you. A send-email action asks first.
import { recordScene } from "../lib/scene";
import { openDot } from "../lib/ui";
import { composer, waitText } from "./_common";

await recordScene({
	name: "s6-approval",
	setup: async ({ page }) => {
		await openDot(page, "Inbox");
		await page.evaluate(() => window.opendotTest!.setFakeScript("approval-send-email"));
	},
	run: async (c) => {
		const { page, cursor } = c;
		await cursor.click(composer(page), 800);
		await c.type("Tell Maya yes on budget v3.");
		await c.pause(300);
		c.mark("send");
		await page.keyboard.press("Enter");
		await cursor.moveTo(1400, 300, 900);
		const allow = page.getByRole("button", { name: /allow once/i }).first();
		await allow.waitFor({ timeout: 60000 });
		c.mark("approval");
		await c.pause(1100);
		await cursor.click(allow, 800);
		c.mark("allowed");
		await waitText(page, "Maya has your approval");
		await c.pause(1500);
	},
});
