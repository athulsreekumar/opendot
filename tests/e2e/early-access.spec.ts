import { expect, type Page, test } from "@playwright/test";

const OPEN = `window.dispatchEvent(new CustomEvent("opendot:early-access",{detail:{source:"nav"}}))`;

async function load(page: Page) {
	await page.goto("/");
	// the server ignores submissions made < 2.5s after the form rendered (timing trap)
	await page.waitForTimeout(2600);
}

async function mockCalls(page: Page) {
	const res = await page.request.get("/api/early-access?mock=calls");
	return (await res.json()).calls as { method: string; payload: { replyTo?: string } }[];
}

const uniq = (tag = "") => `e2e${Date.now()}${Math.floor(Math.random() * 1e4)}${tag}@example.com`;

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.removeItem("opendot:early-access");
		} catch {}
	});
});

test("final-section inline signup succeeds and notifies", async ({ page }) => {
	await load(page);
	const email = uniq();
	const section = page.locator("#early-access");
	await section.scrollIntoViewIfNeeded();
	await section.getByLabel("Email").fill(email);
	await section.getByRole("button", { name: "Get early access" }).click();
	await expect(section.getByText("You’re on the list. We’ll be in touch.")).toBeVisible();
	const calls = await mockCalls(page);
	expect(calls.some((c) => c.method === "emails.send" && c.payload.replyTo === email.toLowerCase())).toBe(true);
	expect(await page.evaluate(() => localStorage.getItem("opendot:early-access"))).toBe("1");
});

test("duplicate email shows the duplicate copy", async ({ page }) => {
	await load(page);
	const section = page.locator("#early-access");
	await section.getByLabel("Email").fill(uniq("+dup").replace("@", "+dup@"));
	await section.getByRole("button", { name: "Get early access" }).click();
	await expect(section.getByText("You’re already on the list — we’ll be in touch.")).toBeVisible();
});

test("invalid email shows the message and sends no request", async ({ page }) => {
	await load(page);
	let posts = 0;
	page.on("request", (r) => {
		if (r.method() === "POST" && r.url().includes("/api/early-access")) posts++;
	});
	const section = page.locator("#early-access");
	const input = section.getByLabel("Email");
	await input.fill("not-an-email");
	await section.getByRole("button", { name: "Get early access" }).click();
	await expect(section.getByText("Please enter a valid email address.")).toBeVisible();
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAttribute("aria-describedby", /.+/);
	expect(posts).toBe(0);
});

test("dialog opens from the event, Esc closes, focus returns", async ({ page }) => {
	await load(page);
	const trigger = page.locator("#early-access").getByLabel("Email");
	await trigger.focus();
	await page.evaluate(OPEN);
	const dialog = page.getByRole("dialog", { name: "Get early access" });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByLabel("Email")).toBeFocused();
	await expect(dialog.getByLabel("What would your first Dot do?")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
});

test("keyboard-only signup in the dialog", async ({ page, isMobile }) => {
	test.skip(isMobile, "keyboard flow is desktop-only");
	await load(page);
	await page.evaluate(OPEN);
	const dialog = page.getByRole("dialog", { name: "Get early access" });
	await expect(dialog.getByLabel("Email")).toBeFocused();
	const email = uniq();
	await page.keyboard.type(email);
	await page.keyboard.press("Tab"); // submit button
	await page.keyboard.press("Tab"); // first dot
	await page.keyboard.type("Watch my inbox");
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Enter");
	await expect(dialog.getByText("You’re on the list. We’ll be in touch.")).toBeVisible();
	await expect(dialog).toHaveCount(0, { timeout: 6000 });
	const calls = await mockCalls(page);
	expect(calls.some((c) => c.method === "emails.send" && c.payload.replyTo === email.toLowerCase())).toBe(true);
});
