// Scene 4: an email arrives while you're elsewhere; the Inbox Dot flags it [URGENT].
import { recordScene } from "../lib/scene";
import { dotIdByName, openDot } from "../lib/ui";
import { row, waitText } from "./_common";

await recordScene({
	name: "s4-alwayson",
	setup: async ({ page }) => {
		await openDot(page, "Research");
		await page.evaluate(() => window.opendotTest!.setFakeScript("inbox-urgent"));
	},
	run: async (c) => {
		const { page, cursor } = c;
		await cursor.hover({ x: 960, y: 430 }, 700);
		await c.pause(500);
		c.mark("event-arrives");
		const inbox = await dotIdByName(page, "Inbox");
		await page.evaluate(
			(id) => window.opendotTest!.emitEvent(id, "Maya Chen: Q4 planning, need your sign-off on the budget", "Reply needed by 18:00", "high"),
			inbox,
		);
		await waitText(page, "Maya Chen needs your sign-off");
		c.mark("urgent-reply");
		await c.pause(900);
		await cursor.click(row(page, "Inbox"), 900);
		c.mark("open-inbox");
		await c.pause(2200);
	},
});
