// Approvals inbox: pending cards with a badge, allow once, deny with a reason, edit then allow, and History.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, screenshot, send } from "./helpers";

function writeScripts(): string {
	const dir = mkdtempSync(join(tmpdir(), "opendot-approval-scripts-"));
	mkdirSync(dir, { recursive: true });
	const writeCall = (name: string, path: string, content: string, said: string) =>
		writeFileSync(
			join(dir, `${name}.json`),
			JSON.stringify({
				name,
				steps: [
					{
						content: [
							{ type: "text", text: said },
							{ type: "toolCall", id: `tc_${name}`, name: "write", arguments: { path, content } },
						],
						stopReason: "toolUse",
					},
					name === "apdeny" ? "$toolresult" : { content: [{ type: "text", text: `Finished ${name}.` }] },
				],
			}),
		);
	writeCall("apallow", "allowed.txt", "original text", "Saving the allowed note.");
	writeCall("apdeny", "denied.txt", "never written", "Saving the denied note.");
	writeCall("apedit", "edited.txt", "original text", "Saving the edited note.");
	return dir;
}

async function grantFiles(page: Page, dotId: string): Promise<void> {
	await page.evaluate(async (id) => {
		const mac = (await window.opendot.connections.list()).find((c) => c.type === "mac")!;
		const d = await window.opendot.dots.get(id as `dot_${string}`);
		await window.opendot.dots.update(d.id, {
			grants: [
				...d.grants.filter((g) => g.connectionId !== mac.id),
				{ connectionId: mac.id, toolRules: {}, features: ["files"] },
			],
		});
	}, dotId);
}

test("Approvals inbox: allow once, deny with a reason, edit then allow, History", async () => {
	const { app, page } = await launchApp({ env: { OPENDOT_FAKE_SCRIPTS_DIR: writeScripts() } });
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		await grantFiles(page, dotId);
		const workspace = await page.evaluate(
			async (id) => (await window.opendot.dots.get(id as `dot_${string}`)).workspaceDir,
			dotId,
		);
		await openDot(page, dotId);

		const nav = page.getByRole("navigation", { name: "Main" });
		const goInbox = async () => {
			await nav.getByRole("button", { name: "Approvals" }).click();
			await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
		};
		const ask = async (script: string, text: string) => {
			await openDot(page, dotId);
			await page.evaluate((s) => window.opendotTest!.setFakeScript(s), script);
			await send(page, text);
			await expect.poll(() => page.evaluate(() => window.opendot.approvals.pending().then((p) => p.length))).toBe(1);
			await goInbox();
		};

		// 1. Allow once: badge, readable card, the file is written, the chat continues.
		await ask("apallow", "save the allowed note");
		await expect(nav.getByRole("button", { name: "Approvals" }).locator("..").getByText("1")).toBeVisible();
		const card = page.getByRole("group", { name: "Helper wants to write a file" });
		await expect(card).toBeVisible();
		await expect(card.getByText("Saving the allowed note.")).toBeVisible();
		await expect(card.getByText("allowed.txt")).toBeVisible();
		await expect(card.getByText("original text")).toBeVisible();
		await screenshot(page, "approvals-inbox");
		await card.getByRole("button", { name: /allow once/i }).click();
		await expect.poll(() => existsSync(join(workspace, "allowed.txt"))).toBe(true);
		expect(readFileSync(join(workspace, "allowed.txt"), "utf8")).toBe("original text");
		await openDot(page, dotId);
		await expect(page.getByText("Finished apallow.").first()).toBeVisible({ timeout: 30000 });

		// 2. Deny with a reason: the Dot's next reply reflects it.
		await ask("apdeny", "save the denied note");
		await page.getByRole("button", { name: /deny with a reason/i }).click();
		await page.getByLabel("Reason for denying").fill("please ask Sam first");
		await page.getByRole("button", { name: /^deny$/i }).click();
		await openDot(page, dotId);
		await expect(page.getByText(/please ask Sam first/).first()).toBeVisible({ timeout: 30000 });
		expect(existsSync(join(workspace, "denied.txt"))).toBe(false);

		// 3. Edit, then allow: the file holds the edited content.
		await ask("apedit", "save the edited note");
		const editCard = page.getByRole("group", { name: "Helper wants to write a file" });
		await editCard.getByRole("button", { name: /edit, then allow/i }).click();
		await editCard.getByLabel("File content").fill("text I changed myself");
		await editCard.getByRole("button", { name: /allow with my changes/i }).click();
		await expect.poll(() => existsSync(join(workspace, "edited.txt"))).toBe(true);
		expect(readFileSync(join(workspace, "edited.txt"), "utf8")).toBe("text I changed myself");
		await openDot(page, dotId);
		await expect(page.getByText("Finished apedit.").first()).toBeVisible({ timeout: 30000 });

		// 4. History lists all three, newest first, and filters by outcome.
		await goInbox();
		await expect(page.getByText("Nothing is waiting for you.")).toBeVisible();
		await page.getByRole("tab", { name: "History" }).click();
		const rows = page.getByTestId("approval-history-row");
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toContainText("Edited");
		await expect(rows.nth(1)).toContainText("Denied");
		await expect(rows.nth(1)).toContainText("with a reason");
		await expect(rows.nth(2)).toContainText("Allowed");
		await expect(rows.nth(2)).toContainText("Write a file: allowed.txt");
		await screenshot(page, "approvals-history");
		await page.getByRole("combobox", { name: "Filter by outcome" }).click();
		await page.getByRole("option", { name: "Denied" }).click();
		await expect(rows).toHaveCount(1);
		// Persisted in the audit log, without the file contents.
		const audit = await page.evaluate(() => window.opendot.audit.query({ kinds: ["approval"] }));
		expect(audit).toHaveLength(3);
		expect(JSON.stringify(audit)).not.toContain("text I changed myself");
	} finally {
		await app.close();
	}
});
