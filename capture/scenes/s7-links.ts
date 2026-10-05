// Scene 7: Dot Links. You decide who talks to whom; flip a rule and the graph reacts.
import { recordScene } from "../lib/scene";
import { go } from "../lib/ui";

await recordScene({
	name: "s7-links",
	setup: async ({ page }) => {
		await go(page, "#/links", 1500);
	},
	run: async (c) => {
		const { page, cursor } = c;
		await cursor.hover({ x: 520, y: 260 }, 900);
		await c.pause(500);
		const sw = page.getByRole("switch").nth(2);
		c.mark("toggle-off");
		await cursor.click(sw, 900);
		await c.pause(1500);
		c.mark("toggle-on");
		await cursor.click(sw, 500);
		await c.pause(1400);
	},
});
