import { expect, type Page, test } from "@playwright/test";

const BEATS = ["ask", "plan", "split", "review", "done"] as const;

/** Collects console errors and uncaught exceptions for the life of the page. */
function watchErrors(page: Page) {
	const errors: string[] = [];
	page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
	page.on("pageerror", (e) => errors.push(String(e)));
	return errors;
}

/** Scroll through the whole page so lazy images, reveals and pins all run. */
async function scrollThrough(page: Page) {
	const h = await page.evaluate(() => document.documentElement.scrollHeight);
	for (let y = 0; y < h; y += 900) {
		await page.evaluate((top) => window.scrollTo(0, top), y);
		await page.waitForTimeout(40);
	}
	await page.evaluate(() => window.scrollTo(0, 0));
}

const noOverflow = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("home page section", () => {
	test("renders the headline, the departments and the call to action", async ({ page }) => {
		await page.goto("/");
		const section = page.locator("#organisation");
		await expect(section.getByRole("heading", { level: 2 })).toHaveText(/An organisation\.\s*Run by Dots\./);
		await expect(section.getByText("OpenDot Organisation").first()).toBeAttached();
		await expect(section.getByText(/project manager/)).toBeAttached();

		const more = page.locator("#organisation-more");
		await more.scrollIntoViewIfNeeded();
		await expect(more.getByRole("heading", { name: "Thirteen departments. Pick the ones you need." })).toBeVisible();
		// 13 departments plus the "add or remove" note.
		await expect(more.locator(".org-wall > li")).toHaveCount(14);
		await expect(more.locator(".org-templates > li")).toHaveCount(4);
		await expect(more.getByText("Engineering, product, design, security, marketing, finance, admin")).toBeVisible();
		await expect(more.locator(".org-control > li")).toHaveCount(3);
		await expect(more.getByRole("heading", { name: /Playbooks for every department/ })).toBeVisible();
		await expect(more.getByRole("link", { name: "Get it on GitHub" })).toHaveAttribute(
			"href",
			"https://github.com/athulsreekumar/opendot",
		);
		await expect(more.getByRole("link", { name: "See how it works" })).toHaveAttribute(
			"href",
			"/features/organisation",
		);
	});

	test("the real app screenshots have alt text and the names the site expects", async ({ page }) => {
		await page.goto("/");
		const imgs = page.locator('#organisation img[src*="/shots/org-"], #organisation-more img[src*="/shots/org-"]');
		const alts = await imgs.evaluateAll((els) =>
			els.map(
				(el) => [(el as HTMLImageElement).getAttribute("src") ?? "", (el as HTMLImageElement).alt] as [string, string],
			),
		);
		const names = new Set(alts.map(([src]) => /\/shots\/(org-[a-z]+)-/.exec(src)?.[1]).filter(Boolean));
		expect([...names].sort()).toEqual(
			["org-board", "org-chat", "org-drawer", "org-plan", "org-setup", "org-skills", "org-summary", "org-team"].sort(),
		);
		for (const [src, alt] of alts) expect(alt.length, src).toBeGreaterThan(20);
	});

	test("all five storyboard beats are reachable and carry real text", async ({ page, isMobile }) => {
		await page.goto("/");
		await page.waitForLoadState("load");
		const beats = page.locator("#organisation .org-beat");
		await expect(beats).toHaveCount(5);
		for (const id of BEATS) {
			const beat = page.locator(`#organisation .org-beat[data-beat="${id}"]`);
			await expect(beat.getByRole("heading", { level: 3 })).toHaveCount(1);
			// Each beat has a screen reader description of its illustration.
			expect((await beat.locator(".sr-only").first().textContent())?.length ?? 0).toBeGreaterThan(40);
		}

		if (isMobile) {
			// Static, stacked layout: nothing is pinned and every beat is on the page.
			await expect(page.locator("#organisation .pin-spacer")).toHaveCount(0);
			for (const id of BEATS) {
				const beat = page.locator(`#organisation .org-beat[data-beat="${id}"]`);
				await beat.scrollIntoViewIfNeeded();
				await expect(beat).toBeVisible();
				await expect(beat).toHaveCSS("opacity", "1");
			}
			return;
		}

		// Desktop: the stage is pinned and each beat takes its turn as the page scrolls.
		await page.locator("#organisation .org-pin").scrollIntoViewIfNeeded();
		const spacer = page.locator("#organisation .pin-spacer");
		await expect(spacer).toHaveCount(1);
		const { top, height, vh } = await page.evaluate(() => {
			const el = document.querySelector("#organisation .pin-spacer") as HTMLElement;
			const r = el.getBoundingClientRect();
			return { top: r.top + window.scrollY, height: r.height, vh: window.innerHeight };
		});
		for (const [k, id] of BEATS.entries()) {
			const at = top + (height - vh) * ((k * 10 + 5) / 50);
			await page.evaluate((y) => window.scrollTo(0, y), at);
			const beat = page.locator(`#organisation .org-beat[data-beat="${id}"]`);
			await expect
				.poll(async () => Number(await beat.evaluate((el) => getComputedStyle(el).opacity)), { timeout: 8000 })
				.toBeGreaterThan(0.95);
		}
	});

	test("does not scroll sideways and logs no console errors", async ({ page }) => {
		const errors = watchErrors(page);
		await page.goto("/");
		await scrollThrough(page);
		expect(await noOverflow(page)).toBe(true);
		await page.locator("#organisation-more").scrollIntoViewIfNeeded();
		expect(await noOverflow(page)).toBe(true);
		expect(errors).toEqual([]);
	});

	test("the hero pill scrolls to the section", async ({ page }) => {
		await page.goto("/");
		const pill = page.locator("#hero").getByRole("link", { name: "New: OpenDot Organisation" });
		await expect(pill).toHaveAttribute("href", "#organisation");
		await pill.click();
		await expect(page).toHaveURL(/#organisation$/);
		await expect(page.locator("#organisation .org-eyebrow").first()).toBeInViewport({ timeout: 8000 });
	});

	test("the nav link opens the feature page", async ({ page, isMobile }) => {
		await page.goto("/");
		if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
		const link = page.getByRole("banner").getByRole("link", { name: "Organisation", exact: true });
		await expect(link).toHaveAttribute("href", "/features/organisation");
		await link.click();
		await expect(page).toHaveURL(/\/features\/organisation$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
	});

	test("the home FAQ answers the Organisation questions", async ({ page }) => {
		await page.goto("/");
		const faq = page.locator("#faq");
		for (const q of [
			"What is OpenDot Organisation?",
			"Can SuperDot really manage a project across Dots?",
			"Does it cost extra or send my data anywhere?",
		]) {
			await expect(faq.getByText(q, { exact: true })).toBeAttached();
		}
	});
});

test.describe("reduced motion", () => {
	test.use({ reducedMotion: "reduce" });

	test("shows the static, stacked storyboard without pinning", async ({ page }) => {
		const errors = watchErrors(page);
		await page.goto("/");
		await page.waitForLoadState("load");
		await expect(page.locator("#organisation .pin-spacer")).toHaveCount(0);
		for (const id of BEATS) {
			const beat = page.locator(`#organisation .org-beat[data-beat="${id}"]`);
			await beat.scrollIntoViewIfNeeded();
			await expect(beat).toBeVisible();
			await expect(beat).toHaveCSS("opacity", "1");
			await expect(beat).toHaveCSS("position", "relative");
		}
		await expect(page.locator("#organisation .org-rail")).toBeHidden();
		expect(await noOverflow(page)).toBe(true);
		expect(errors).toEqual([]);
	});
});

test.describe("Organisation pages", () => {
	for (const [path, h2min] of [
		["/features/organisation", 9],
		["/guides/run-a-project-with-ai-team", 6],
	] as const) {
		test(`${path} renders with one h1, alt text and structured data`, async ({ page }) => {
			const errors = watchErrors(page);
			await page.goto(path);
			await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
			expect(await page.locator("article h2").count()).toBeGreaterThanOrEqual(h2min);
			await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", new RegExp(`${path}$`));
			const imgs = page.locator("article img");
			expect(await imgs.count()).toBeGreaterThanOrEqual(3);
			for (const alt of await imgs.evaluateAll((els) => els.map((e) => (e as HTMLImageElement).alt))) {
				expect(alt.length).toBeGreaterThan(20);
			}
			const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
			const types = (JSON.parse(ld ?? "{}")["@graph"] as { "@type": string }[]).map((n) => n["@type"]);
			expect(types).toContain("FAQPage");
			expect(types).toContain("BreadcrumbList");
			expect(await noOverflow(page)).toBe(true);
			await scrollThrough(page);
			expect(errors).toEqual([]);
		});
	}

	test("the feature hub, the guides hub and the footer link to them", async ({ page }) => {
		await page.goto("/features");
		await expect(
			page
				.locator("article")
				.getByRole("link", { name: /OpenDot Organisation/ })
				.first(),
		).toHaveAttribute("href", "/features/organisation");
		await page.goto("/guides");
		await expect(page.locator("article").getByRole("link", { name: /Run a Project with an AI Team/ })).toHaveAttribute(
			"href",
			"/guides/run-a-project-with-ai-team",
		);
		const footer = page.getByRole("contentinfo");
		await expect(footer.getByRole("link", { name: "OpenDot Organisation" })).toHaveAttribute(
			"href",
			"/features/organisation",
		);
		await expect(footer.getByRole("link", { name: "Run a project with an AI team" })).toHaveAttribute(
			"href",
			"/guides/run-a-project-with-ai-team",
		);
	});

	test("the sitemap and llms.txt list the new pages", async ({ request }) => {
		const sitemap = await (await request.get("/sitemap.xml")).text();
		expect(sitemap).toContain("/features/organisation");
		expect(sitemap).toContain("/guides/run-a-project-with-ai-team");
		const llms = await (await request.get("/llms.txt")).text();
		expect(llms).toContain("OpenDot Organisation");
		expect(llms).toContain("/features/organisation");
	});
});
