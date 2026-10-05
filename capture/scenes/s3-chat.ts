// Scene 3: a reply streams in from the first word (table + list).
import { recordScene } from "../lib/scene";
import { go } from "../lib/ui";
import { composer, row, waitText } from "./_common";

await recordScene({
	name: "s3-chat",
	setup: async ({ page }) => {
		await go(page, "#/chats", 900);
		await page.evaluate(() => window.opendotTest!.setFakeScript("research-summary"));
	},
	run: async (c) => {
		const { page, cursor } = c;
		await cursor.click(row(page, "Research"), 800);
		await c.pause(700);
		await cursor.click(composer(page), 700);
		await c.type("Which standing desk should I buy under $600?");
		await c.pause(350);
		c.mark("send");
		await page.keyboard.press("Enter");
		await cursor.moveTo(1500, 520, 900);
		await waitText(page, "Confidence: medium");
		c.mark("done");
		await c.pause(1500);
	},
});
