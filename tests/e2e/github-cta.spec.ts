import { expect, test } from "@playwright/test";

const REPO = "https://github.com/athulsreekumar/opendot";

test("calls to action point to GitHub and the Open source section is back", async ({ page, isMobile }) => {
	await page.goto("/");
	if (!isMobile) {
		const navCta = page.locator("header").getByRole("link", { name: "GitHub" });
		await expect(navCta).toHaveAttribute("href", REPO);
		await expect(navCta).toHaveAttribute("target", "_blank");
	}
	const hero = page.locator("#hero");
	await expect(hero.getByRole("link", { name: "Get it on GitHub" })).toHaveAttribute("href", REPO);
	await expect(hero.getByRole("link", { name: "How to build it" })).toHaveAttribute("href", "/download");

	const openSource = page.locator("#open-source");
	await expect(openSource).toBeVisible();
	await expect(openSource.getByRole("link", { name: /View on GitHub/ })).toHaveAttribute("href", REPO);

	const final = page.locator("#get-opendot");
	await expect(final.getByRole("link", { name: "Get it on GitHub" })).toHaveAttribute("href", REPO);
	await expect(final.getByRole("textbox")).toHaveCount(0);
	await expect(page.getByText(/early access/i)).toHaveCount(0);
});

test("inner pages lead to GitHub too", async ({ page }) => {
	await page.goto("/features/superdot");
	await expect(page.getByRole("link", { name: "Get it on GitHub" }).first()).toHaveAttribute("href", REPO);
	await page.goto("/download");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Download OpenDot for Mac and Windows");
	await expect(page.getByText(/early access/i)).toHaveCount(0);
});
