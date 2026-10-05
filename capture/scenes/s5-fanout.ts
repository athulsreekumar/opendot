// Scene 5: one question, every Dot. SuperDot fans out in parallel and answers with citations.
import { recordScene } from "../lib/scene";
import { openDot } from "../lib/ui";
import { composer, waitText } from "./_common";

await recordScene({
	name: "s5-fanout",
	setup: async ({ page }) => {
		await openDot(page, "SuperDot");
		await page.evaluate(() => window.opendotTest!.setFakeScript("superbot-tomorrow"));
	},
	run: async (c) => {
		const { page, cursor } = c;
		await cursor.click(composer(page), 800);
		await c.type("What do I need to prepare for tomorrow?");
		await c.pause(300);
		c.mark("send");
		await page.keyboard.press("Enter");
		await cursor.moveTo(1500, 380, 900);
		await waitText(page, "No travel tasks tomorrow");
		c.mark("answer");
		await c.pause(1800);
	},
});
