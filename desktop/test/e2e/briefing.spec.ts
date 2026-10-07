import { expect, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, send } from "./helpers";

/** Two Dots that SuperDot will brief from; the briefing includes them because the user ticks them. */
async function setupBriefing(page: import("@playwright/test").Page) {
	await quickSetup(page);
	const inbox = await createDot(page, "inbox", "Inbox");
	const calendar = await createDot(page, "calendar", "Calendar");
	const superId = (await page.evaluate(() => window.opendot.superbot.get())).id;
	await page.evaluate(
		async ({ inbox, calendar }) => {
			await window.opendot.settings.update({
				briefing: {
					// Late time, so the real scheduler never fires during the test.
					enabled: false,
					time: "23:59",
					days: "weekdays",
					dots: { [inbox]: true, [calendar]: true },
					instructions: "",
				},
			});
		},
		{ inbox, calendar },
	);
	return superId;
}

test("Run briefing now streams a briefing card with citations into SuperDot's chat", async () => {
	const { app, page } = await launchApp();
	try {
		const superId = await setupBriefing(page);
		await page.evaluate(() => window.opendotTest!.setFakeScript("briefing"));
		await page.evaluate(() => {
			window.location.hash = "#/settings/briefing";
		});
		await expect(page.getByTestId("briefing-settings")).toBeVisible();
		await expect(page.getByRole("switch", { name: "Include Inbox" })).toBeChecked();
		await page.getByRole("switch", { name: "Send me a daily briefing" }).click();
		await expect
			.poll(() => page.evaluate(() => window.opendot.settings.get().then((s) => s.briefing?.enabled)))
			.toBe(true);
		await expect(page.getByText(/Next briefing:/)).toBeVisible();
		await page.getByRole("button", { name: "Run briefing now" }).click();
		// It opens SuperDot's chat, where the card streams in.
		await expect(page.locator("article[data-briefing]").first()).toBeVisible({ timeout: 40000 });
		await expect(page.getByText(/Design review at 15:00/).first()).toBeVisible({ timeout: 40000 });
		await expect(page.getByText(/Briefing · \w{3} \d{1,2} \w{3}/).first()).toBeVisible();
		// Citations render as chips for known Dots.
		await expect(page.getByText("Inbox").first()).toBeVisible();
		// Exchanges are recorded a moment after the card text appears (slower on CI), so wait for both.
		await expect
			.poll(
				async () =>
					(await page.evaluate(() => window.opendot.links.exchanges())).filter((x) => x.status === "done").length,
				{ timeout: 15000 },
			)
			.toBe(2);
		// The card survives a history reload, and today is recorded as done.
		await page.waitForTimeout(800);
		const hist = await page.evaluate((id) => window.opendot.chat.history(id as `dot_${string}`), superId);
		expect(hist.messages.some((m) => m.briefing && /Design review/.test(m.text))).toBe(true);
		const st = await page.evaluate(() => window.opendot.briefing.status());
		expect(st.lastRunDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	} finally {
		await app.close();
	}
});

test("/briefing in SuperDot's composer runs the briefing", async () => {
	const { app, page } = await launchApp();
	try {
		const superId = await setupBriefing(page);
		await page.evaluate(() => window.opendotTest!.setFakeScript("briefing"));
		await openDot(page, superId);
		await send(page, "/briefing");
		await expect(page.getByText(/Design review at 15:00/).first()).toBeVisible({ timeout: 40000 });
		await expect(page.locator("article[data-briefing]").first()).toBeVisible();
	} finally {
		await app.close();
	}
});

test("with no connected Dots the briefing says so and suggests connecting Google or Microsoft", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const superId = (await page.evaluate(() => window.opendot.superbot.get())).id;
		await openDot(page, superId);
		const r = await page.evaluate(() => window.opendot.briefing.run());
		expect(r.started).toBe(false);
		await expect(page.getByText(/Google or Microsoft/).first()).toBeVisible({ timeout: 10000 });
	} finally {
		await app.close();
	}
});

test("SuperDot's empty state turns the briefing on in one click", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const superId = (await page.evaluate(() => window.opendot.superbot.get())).id;
		await openDot(page, superId);
		await page.getByRole("button", { name: "Get a daily briefing at 8:00" }).click();
		await expect
			.poll(() => page.evaluate(() => window.opendot.settings.get().then((s) => s.briefing?.enabled)))
			.toBe(true);
		const s = await page.evaluate(() => window.opendot.settings.get());
		expect(s.briefing?.time).toBe("08:00");
		expect(s.briefing?.days).toBe("weekdays");
	} finally {
		await app.close();
	}
});
