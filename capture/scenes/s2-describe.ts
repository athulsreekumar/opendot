// Scene 2: describe a Dot, tick Gmail and Calendar, watch its identity stream in, create it.
import { recordScene } from "../lib/scene";
import { go } from "../lib/ui";
import { waitText } from "./_common";

await recordScene({
	name: "s2-describe",
	seed: "noinbox",
	setup: async ({ page }) => {
		await go(page, "#/chats", 900);
		await page.evaluate(() => window.opendotTest!.setFakeScript("create-inbox"));
	},
	run: async (c) => {
		const { page, cursor } = c;
		await cursor.click(page.getByRole("button", { name: "New Dot" }).first(), 900);
		await page.locator("#newdot-prompt").waitFor();
		c.mark("dialog-open");
		await c.pause(500);
		await cursor.click(page.locator("#newdot-prompt"), 600);
		await c.type("Watch my inbox and tell me what needs me.");
		c.mark("typed");
		await c.pause(350);
		await cursor.click(page.getByRole("button", { name: /^Gmail/ }).first(), 650);
		await c.pause(300);
		await cursor.click(page.getByRole("button", { name: /^Google Calendar/ }).first(), 450);
		await c.beat();
		c.mark("generate");
		await cursor.click(page.getByRole("button", { name: /create personality/i }), 650);
		// Bring the streaming identity card into view.
		await page.evaluate(() =>
			[...document.querySelectorAll("button")].find((b) => /create personality/i.test(b.textContent ?? ""))?.scrollIntoView({ behavior: "smooth", block: "end" }),
		);
		const create = page.getByRole("button", { name: /create dot/i });
		await create.waitFor({ timeout: 60000 });
		c.mark("review");
		await c.pause(700);
		await create.evaluate((b) => b.scrollIntoView({ behavior: "smooth", block: "end" }));
		await c.pause(700);
		await cursor.click(create, 700);
		await waitText(page, "is ready");
		c.mark("created");
		await cursor.moveTo(1180, 560, 700);
		await c.pause(1400);
	},
});
