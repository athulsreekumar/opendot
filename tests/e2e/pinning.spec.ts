import { expect, type Locator, test } from "@playwright/test";

/** Only the Organisation storyboard pins. Every other homepage section is normal flow and shows its finished content. */

/** Effective opacity: the element's own times that of every ancestor (Reveal fades a wrapper, not the leaf). */
const opacityOf = (loc: Locator) =>
	loc.evaluate((el) => {
		let o = 1;
		for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
		return o;
	});

async function readable(loc: Locator) {
	// Centre it: Reveal fires once the element's top passes 85% of the viewport.
	await loc.evaluate((el) => el.scrollIntoView({ block: "center" }));
	await expect(loc).toBeVisible();
	await expect.poll(() => opacityOf(loc), { timeout: 8000, message: String(loc) }).toBeGreaterThan(0.95);
}

const SECTIONS: { id: string; key: (s: Locator) => Locator[] }[] = [
	{ id: "statement", key: (s) => [s.getByRole("heading", { level: 2 })] },
	{
		id: "create",
		key: (s) => [
			s.getByRole("heading", { level: 3, name: "Tell it what to do." }),
			s.getByRole("heading", { level: 3, name: "Pick what it can touch." }),
			s.getByRole("heading", { level: 3, name: "Meet your new Dot." }),
			s.locator("img").last(),
		],
	},
	{
		id: "always-on",
		key: (s) => [
			s.getByRole("heading", { level: 2 }),
			s.getByText("Invoice overdue: Northwind Labs"),
			s.getByText("Q3 deck edited by Leo Park"),
			s.getByText("[URGENT]"),
		],
	},
	{
		id: "superdot",
		key: (s) => [
			s.getByRole("heading", { level: 2 }),
			s.getByText("What do I need to prepare for tomorrow?"),
			s.locator("img").last(),
		],
	},
	{
		id: "privacy",
		key: (s) => [
			s.getByRole("heading", { level: 2 }),
			s.getByText("Emails, phone numbers and card details are masked", { exact: false }),
			s.getByText("Your keys are encrypted by your operating system."),
		],
	},
];

test.describe("pinning", () => {
	test("only Organisation is pinned; the other sections are plain flow with their content visible", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/");
		await page.waitForLoadState("load");

		const spacers = page.locator(".pin-spacer");
		if (isMobile) {
			await expect(spacers).toHaveCount(0);
		} else {
			await expect(spacers).toHaveCount(1);
			await expect(page.locator("#organisation .pin-spacer")).toHaveCount(1);
		}

		for (const { id, key } of SECTIONS) {
			const section = page.locator(`#${id}`);
			await expect(section.locator(".pin-spacer")).toHaveCount(0);
			for (const loc of key(section)) await readable(loc.first());
			const { position, height, vh } = await section.evaluate((el) => ({
				position: getComputedStyle(el.firstElementChild as Element).position,
				height: el.getBoundingClientRect().height,
				vh: window.innerHeight,
			}));
			expect(position, `${id} is not fixed`).not.toBe("fixed");
			// A pinned section would be padded by a spacer of several screens; these are one or two screens at most.
			expect(height, `${id} height`).toBeLessThan(vh * 3);
		}
	});

	test("the homepage does not scroll sideways", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("load");
		for (const { id } of SECTIONS) await page.locator(`#${id}`).scrollIntoViewIfNeeded();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
		).toBe(true);
	});
});

test.describe("pinning with reduced motion", () => {
	test.use({ reducedMotion: "reduce" });

	test("nothing is pinned", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("load");
		await expect(page.locator(".pin-spacer")).toHaveCount(0);
	});
});
