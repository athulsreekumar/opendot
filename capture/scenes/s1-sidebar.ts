// Scene 1: the sidebar fills up, one Dot at a time, then a chat opens.
import { recordScene } from "../lib/scene";
import { go } from "../lib/ui";
import { archiveAllButSuper, row } from "./_common";

await recordScene({
	name: "s1-sidebar",
	prepare: (dir) => archiveAllButSuper(dir),
	setup: async ({ page }) => {
		await go(page, "#/chats", 900);
	},
	run: async (c) => {
		const { page, cursor } = c;
		c.mark("sidebar-empty");
		await c.pause(500);
		for (const name of ["Research", "Travel", "Code Buddy", "Money", "Calendar", "Inbox"]) {
			await page.evaluate(async (n) => {
				const d = (await window.opendot.dots.list()).find((x) => x.name === n)!;
				await window.opendot.dots.update(d.id, { archived: false });
			}, name);
			c.mark(`dot:${name}`);
			await c.pause(720);
		}
		await c.beat();
		await cursor.hover(row(page, "Calendar"), 600);
		await c.pause(250);
		await cursor.hover(row(page, "Money"), 500);
		await c.pause(250);
		c.mark("open-inbox");
		await cursor.click(row(page, "Inbox"), 700);
		await c.pause(1300);
	},
});
