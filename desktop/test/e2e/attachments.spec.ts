// Files and images in chat: attach via the picker, drop and paste; the fake model sees them; history keeps them.
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, screenshot } from "./helpers";

// 1x1 PNG
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function dropFile(page: Page, file: { name: string; type: string; b64?: string; text?: string }): Promise<void> {
	await page.evaluate((f) => {
		const dt = new DataTransfer();
		const parts: BlobPart[] = f.b64 ? [Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))] : [f.text ?? ""];
		dt.items.add(new File(parts, f.name, { type: f.type }));
		const target = document.querySelector("section[aria-label^='Chat with']") as HTMLElement;
		target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
		target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
		target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
	}, file);
}

test("attach a text file with the picker: chip, inlined and masked for the model, copied to the workspace", async () => {
	const { app, page, dataDir } = await launchApp();
	try {
		await quickSetup(page);
		const id = await createDot(page, "general", "Helper");
		await openDot(page, id);
		await page.evaluate(() => window.opendotTest!.setFakeScript("pii-capture"));

		const dir = mkdtempSync(join(tmpdir(), "od-att-"));
		const file = join(dir, "contacts.csv");
		writeFileSync(file, "name,email\nAnn,ann.lee@example.com\n");
		await page.evaluate((p) => window.opendotTest!.setNextPick([p]), file);
		await page.getByRole("button", { name: "Attach files" }).click();

		await expect(page.getByTestId("attachment-draft").getByText("contacts.csv")).toBeVisible();
		await screenshot(page, "attachments-tray");
		await page.locator("textarea").last().fill("who is in this list?");
		await page.locator("textarea").last().press("Enter");

		await expect
			.poll(async () => (await page.evaluate(() => window.opendotTest!.getCaptured())).length, { timeout: 20000 })
			.toBeGreaterThan(0);
		const captured = (await page.evaluate(() => window.opendotTest!.getCaptured())).join("\n");
		expect(captured).toContain("name,email");
		expect(captured).toContain("who is in this list?");
		// Inlined text is masked exactly like typed text.
		expect(captured).not.toContain("ann.lee@example.com");
		expect(captured).toContain("⟦EMAIL_1⟧");

		// The message shows a chip, not the file body.
		const sent = page.getByTestId("message-attachments");
		await expect(sent.getByText("contacts.csv")).toBeVisible();
		await expect(page.getByText("name,email")).toHaveCount(0);
		await expect(page.getByTestId("attachment-draft")).toHaveCount(0);

		// A copy landed in the Dot's workspace.
		const attDir = join(dataDir, "dots", id, "workspace", "attachments");
		await expect.poll(() => existsSync(attDir)).toBe(true);
		const files = readdirSync(attDir);
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/^\d{8}T\d{6}-contacts\.csv$/);
		expect(readFileSync(join(attDir, files[0]!), "utf8")).toContain("ann.lee@example.com");

		// Still there after a reload.
		await page.reload();
		await openDot(page, id);
		await expect(page.getByTestId("message-attachments").getByText("contacts.csv")).toBeVisible({ timeout: 15000 });
		await screenshot(page, "attachments-chip");
	} finally {
		await app.close();
	}
});

test("drop an image: overlay, thumbnail, the model receives it, lightbox and history after reload", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const id = await createDot(page, "general", "Looker");
		await openDot(page, id);

		await page.evaluate(() => {
			const dt = new DataTransfer();
			dt.items.add(new File(["x"], "a.png", { type: "image/png" }));
			document
				.querySelector("section[aria-label^='Chat with']")!
				.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
		});
		await expect(page.getByText("Drop to add to the chat")).toBeVisible();
		await dropFile(page, { name: "dot.png", type: "image/png", b64: PNG_B64 });
		await expect(page.getByText("Drop to add to the chat")).toHaveCount(0);
		await expect(page.getByTestId("attachment-draft").getByRole("img", { name: "dot.png" })).toBeVisible();

		await page.locator("textarea").last().fill("what colour is this?");
		await page.locator("textarea").last().press("Enter");
		await expect(page.getByText(/Fake model received 1 image/)).toBeVisible({ timeout: 20000 });

		const thumb = page.getByTestId("message-attachments").getByRole("img", { name: "dot.png" });
		await expect(thumb).toBeVisible();
		await expect.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
		await thumb.click();
		await expect(page.getByRole("dialog").getByRole("img", { name: "dot.png" })).toBeVisible();
		await page.keyboard.press("Escape");

		await page.reload();
		await openDot(page, id);
		const again = page.getByTestId("message-attachments").getByRole("img", { name: "dot.png" });
		await expect(again).toBeVisible({ timeout: 15000 });
		await expect.poll(() => again.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
		await screenshot(page, "attachments-image");
	} finally {
		await app.close();
	}
});

test("a binary file is copied to the workspace and the Dot is told the path; limits show friendly errors", async () => {
	const { app, page, dataDir } = await launchApp();
	try {
		await quickSetup(page);
		const id = await createDot(page, "general", "Filer");
		await openDot(page, id);
		await page.evaluate(() => window.opendotTest!.setFakeScript("pii-capture"));

		await dropFile(page, { name: "Report.pdf", type: "application/pdf", text: "%PDF-1.4 fake" });
		await expect(page.getByTestId("attachment-draft").getByText("Report.pdf")).toBeVisible();
		// Over the limit: nothing is added and the reason is shown.
		await page.evaluate(() => {
			const dt = new DataTransfer();
			dt.items.add(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.zip", { type: "application/zip" }));
			document
				.querySelector("section[aria-label^='Chat with']")!
				.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
		});
		await expect(page.getByText("big.zip is over 10 MB. Choose a smaller file.")).toBeVisible();
		await expect(page.getByTestId("attachment-draft")).toHaveCount(1);

		// Attachments alone are enough to send.
		await page.getByRole("button", { name: "Send" }).click();
		await expect
			.poll(async () => (await page.evaluate(() => window.opendotTest!.getCaptured())).length, { timeout: 20000 })
			.toBeGreaterThan(0);
		const captured = (await page.evaluate(() => window.opendotTest!.getCaptured())).join("\n");
		expect(captured).toMatch(/saved at attachments\/\d{8}T\d{6}-Report\.pdf in your workspace/);
		expect(readdirSync(join(dataDir, "dots", id, "workspace", "attachments"))[0]).toMatch(/^\d{8}T\d{6}-Report\.pdf$/);
	} finally {
		await app.close();
	}
});
