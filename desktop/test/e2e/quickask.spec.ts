// Global quick-ask bar. Playwright can't press a system-wide hotkey, so the test hook opens the bar the same way the
// hotkey does (QuickAskController.show) and everything after that is driven through the real window.
import { resolve } from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, screenshot } from "./helpers";

const ECHO = resolve(import.meta.dirname, "../fixtures/mcp-echo-server.mjs");

async function openBar(app: ElectronApplication, page: Page): Promise<Page> {
	await page.evaluate(() => window.opendotTest!.openQuickAsk());
	await expect.poll(() => app.windows().some((w) => w.url().includes("#/quick")), { timeout: 20000 }).toBe(true);
	const bar = app.windows().find((w) => w.url().includes("#/quick"))!;
	await expect(bar.getByPlaceholder("Ask SuperDot, or @ a Dot")).toBeVisible({ timeout: 20000 });
	return bar;
}

const state = (page: Page) => page.evaluate(() => window.opendotTest!.quickAskState());

test("quick ask: opens, streams a SuperDot answer, and Escape hides it", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		await expect(page.getByText("SuperDot").first()).toBeVisible({ timeout: 20000 });
		const bar = await openBar(app, page);
		expect((await state(page)).visible).toBe(true);

		const input = bar.getByPlaceholder("Ask SuperDot, or @ a Dot");
		await expect(input).toBeFocused();
		await input.fill("what is new today?");
		await input.press("Enter");
		const answer = bar.getByTestId("quick-answer");
		await expect(answer.getByText("You said: what is new today?").first()).toBeVisible({ timeout: 30000 });
		await expect(bar.getByRole("button", { name: /open in opendot/i })).toBeVisible();
		await expect(bar.getByRole("button", { name: /copy/i })).toBeVisible();
		// The window grew to fit the answer.
		await expect.poll(async () => (await state(page)).height).toBeGreaterThan(150);
		await screenshot(bar, "quickask-answer");

		// Same exchange is in SuperDot's normal chat history.
		const supId = await page.evaluate(async () => (await window.opendot.superbot.get()).id);
		const hist = await page.evaluate((id) => window.opendot.chat.history(id as `dot_${string}`), supId);
		expect(hist.messages.some((m) => m.text.includes("what is new today?"))).toBe(true);

		await bar.keyboard.press("Escape");
		await expect.poll(async () => (await state(page)).visible).toBe(false);

		// Opening again: compact, input focused with the previous text selected.
		const bar2 = await openBar(app, page);
		await expect.poll(async () => (await state(page)).visible).toBe(true);
		const input2 = bar2.getByPlaceholder("Ask SuperDot, or @ a Dot");
		await expect(input2).toHaveValue("what is new today?");
		await expect(bar2.getByTestId("quick-answer")).toHaveCount(0);
		await expect(input2).toBeFocused();
		await expect
			.poll(() =>
				input2.evaluate((el: HTMLInputElement) => el.selectionStart === 0 && el.selectionEnd === el.value.length),
			)
			.toBe(true);

		// The shortcut key toggles it closed again.
		await page.evaluate(() => window.opendotTest!.openQuickAsk(true));
		await expect.poll(async () => (await state(page)).visible).toBe(false);
	} finally {
		await app.close();
	}
});

test("quick ask: @Dot goes to that Dot's chat, which shows it in the main window", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		const bar = await openBar(app, page);
		const input = bar.getByPlaceholder("Ask SuperDot, or @ a Dot");

		await input.fill("@He");
		const list = bar.getByRole("listbox", { name: "Mention a Dot" });
		await expect(list.getByRole("option", { name: /Helper/ })).toBeVisible();
		await input.press("Enter");
		await expect(input).toHaveValue("@Helper ");
		await input.pressSequentially("ping from the bar");
		await input.press("Enter");
		await expect(bar.getByTestId("quick-answer").getByText("You said: ping from the bar").first()).toBeVisible({
			timeout: 30000,
		});
		await expect(bar.getByTestId("quick-answer").getByText("Helper", { exact: true })).toBeVisible();

		// "Open in OpenDot" hides the bar and shows the chat in the main window.
		await bar.getByRole("button", { name: /open in opendot/i }).click();
		await expect.poll(async () => (await state(page)).visible).toBe(false);
		await expect(page.getByText("You said: ping from the bar").first()).toBeVisible({ timeout: 20000 });
		await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#/chats/${dotId}`);

		// It never went to SuperDot.
		const supId = await page.evaluate(async () => (await window.opendot.superbot.get()).id);
		const sup = await page.evaluate((id) => window.opendot.chat.history(id as `dot_${string}`), supId);
		expect(sup.messages.some((m) => m.text.includes("ping from the bar"))).toBe(false);
		await openDot(page, dotId);
	} finally {
		await app.close();
	}
});

test("quick ask: Ctrl+Enter opens the chat and blur hides the bar", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		const bar = await openBar(app, page);
		const input = bar.getByPlaceholder("Ask SuperDot, or @ a Dot");
		await input.fill("@Helper quick one");
		await input.press("Enter");
		await expect(bar.getByTestId("quick-answer").getByText("You said: quick one").first()).toBeVisible({
			timeout: 30000,
		});
		await bar.keyboard.press("Control+Enter");
		await expect.poll(async () => (await state(page)).visible).toBe(false);
		await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#/chats/${dotId}`);

		await openBar(app, page);
		await expect.poll(async () => (await state(page)).visible).toBe(true);
		await page.evaluate(() => window.opendotTest!.blurQuickAsk());
		await expect.poll(async () => (await state(page)).visible).toBe(false);
	} finally {
		await app.close();
	}
});

test("quick ask: a tool that needs approval asks inline and is not lost", async () => {
	const { app, page } = await launchApp({ env: { ELECTRON_EXE: "" } });
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		const exe = await app.evaluate(() => process.execPath);
		const conId = await page.evaluate(
			async ({ echo, exe, dotId }) => {
				const c = await window.opendot.connections.install({
					custom: {
						type: "mcp-stdio",
						name: "echo",
						label: "Echo",
						command: exe,
						args: [echo],
						env: { ELECTRON_RUN_AS_NODE: "1" },
						secretEnv: {},
					},
				});
				await window.opendot.connections.check(c.id);
				const d = await window.opendot.dots.get(dotId as `dot_${string}`);
				await window.opendot.dots.update(d.id, { grants: [...d.grants, { connectionId: c.id, toolRules: {} }] });
				return c.id;
			},
			{ echo: ECHO, exe, dotId },
		);
		expect(conId).toBeTruthy();
		await page.evaluate(() => window.opendotTest!.setFakeScript("tool-destructive"));
		const bar = await openBar(app, page);
		const input = bar.getByPlaceholder("Ask SuperDot, or @ a Dot");
		await input.fill("@Helper delete everything");
		await input.press("Enter");
		await expect(bar.getByText("Needs your approval")).toBeVisible({ timeout: 30000 });
		// Clicking away doesn't hide the bar while an approval is waiting.
		await page.evaluate(() => window.opendotTest!.blurQuickAsk());
		await page.waitForTimeout(300);
		expect((await state(page)).visible).toBe(true);
		await screenshot(bar, "quickask-approval");
		await bar.getByRole("button", { name: "Deny" }).click();
		await expect(bar.getByText(/didn't delete anything/i).first()).toBeVisible({ timeout: 30000 });
		expect(await page.evaluate(() => window.opendot.approvals.pending())).toHaveLength(0);
	} finally {
		await app.close();
	}
});

test("quick ask: Settings turns the shortcut off and on", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		await expect.poll(async () => (await state(page)).accelerator).toBe("Alt+Space");
		const registered = (await state(page)).shortcutRegistered;
		// Linux CI may not allow grabbing Alt+Space; the status must still agree with the OS-level answer.
		const status = await page.evaluate(() => window.opendot.quickAsk.status());
		expect(status.registered).toBe(registered);
		if (!registered) expect(status.error).toMatch(/in use by another app/i);

		await page.evaluate(() => {
			window.location.hash = "#/settings/quick-ask";
		});
		const toggle = page.getByRole("switch", { name: /turn on quick ask/i });
		await expect(toggle).toBeChecked();
		await toggle.click();
		await expect(toggle).not.toBeChecked();
		await expect.poll(async () => (await state(page)).shortcutRegistered).toBe(false);
		expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered("Alt+Space"))).toBe(false);
		expect((await page.evaluate(() => window.opendot.settings.get())).quickAsk).toEqual({
			enabled: false,
			shortcut: "Alt+Space",
		});

		// Pick another preset and turn it back on.
		await toggle.click();
		await expect(toggle).toBeChecked();
		await page.getByRole("combobox", { name: /quick ask shortcut/i }).click();
		await page.getByRole("option", { name: "Ctrl+Shift+Space" }).click();
		await expect.poll(async () => (await state(page)).accelerator).toBe("Ctrl+Shift+Space");
		expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered("Alt+Space"))).toBe(false);
		if (registered)
			expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered("Ctrl+Shift+Space"))).toBe(true);
		await screenshot(page, "quickask-settings");
	} finally {
		await app.close();
	}
});

test("quick ask: the empty chat mentions the shortcut", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		await page.getByText("SuperDot").first().click();
		await expect(page.getByText(/Tip: press .+ anywhere to ask/)).toBeVisible({ timeout: 20000 });
	} finally {
		await app.close();
	}
});
