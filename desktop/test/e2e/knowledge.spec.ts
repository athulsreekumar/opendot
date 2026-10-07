// Knowledge: index a folder of notes, grant it to a Dot, and see a cited answer.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, screenshot, send } from "./helpers";

function makeNotes(): string {
	const dir = mkdtempSync(join(tmpdir(), "opendot-notes-"));
	mkdirSync(join(dir, "sub"), { recursive: true });
	writeFileSync(
		join(dir, "sourdough.md"),
		"# Sourdough\n\nMix rye flour and water, then feed the starter every morning.\n\n## Baking\n\nBake the bread at 230 degrees for forty minutes.\n",
	);
	writeFileSync(join(dir, "sub", "budget.txt"), "Quarterly budget review.\nTravel costs are down this quarter.\n");
	writeFileSync(join(dir, "garden.md"), "# Garden\n\nPlant tomatoes after the last frost in spring.\n");
	return dir;
}

test("Knowledge: add a folder, grant it to a Dot, get an answer with source chips", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const notes = makeNotes();

		// The built-in connection lists its tools.
		const knowledge = (await page.evaluate(() => window.opendot.connections.list())).find(
			(c) => c.type === "knowledge",
		)!;
		expect(knowledge.label).toBe("Knowledge");
		await page.evaluate((id) => {
			window.location.hash = `#/connections/${id}`;
		}, knowledge.id);
		await expect(page.getByRole("heading", { name: "Knowledge", level: 2 })).toBeVisible();
		await expect(page.getByText("knowledge_search", { exact: true })).toBeVisible();
		await expect(page.getByText("knowledge_read", { exact: true })).toBeVisible();
		await expect(page.getByText(/No folders yet/)).toBeVisible();

		// Add a folder through the test hook (the native picker can't be driven) and watch it get indexed.
		await page.evaluate((p) => window.opendotTest!.knowledgeAddFolder(p), notes);
		await expect(page.getByTestId("knowledge-folder")).toBeVisible();
		await expect(page.getByTestId("knowledge-file-count")).toHaveText("3 files", { timeout: 20000 });
		await expect(page.getByTestId("knowledge-folder").getByText("Ready")).toBeVisible();
		await screenshot(page, "knowledge-detail");

		// It also shows up as a tickable connector in New Dot.
		const choices = await page.evaluate(() => window.opendot.dots.connectorChoices());
		expect(choices.find((c) => c.id === "knowledge")).toMatchObject({ label: "Knowledge", kind: "installed" });

		// Grant Knowledge to a Dot and ask.
		const dotId = await createDot(page, "general", "Librarian");
		await page.evaluate(
			async ({ id, conn }) => {
				const d = await window.opendot.dots.get(id as `dot_${string}`);
				await window.opendot.dots.update(d.id, {
					grants: [...d.grants, { connectionId: conn as `con_${string}`, toolRules: {} }],
				});
			},
			{ id: dotId, conn: knowledge.id },
		);
		await openDot(page, dotId);
		await page.evaluate(() => window.opendotTest!.setFakeScript("knowledge-search"));
		await send(page, "How do I feed my sourdough starter?");
		await expect(
			page.getByRole("region", { name: /Chat with/ }).getByText(/feed the starter every morning with rye flour/),
		).toBeVisible({ timeout: 30000 });

		const chip = page.getByTestId("knowledge-sources").getByRole("button", { name: /sourdough\.md . Sourdough/ });
		await expect(chip).toBeVisible();
		await expect(chip).toContainText("Sourdough");
		await screenshot(page, "knowledge-citations");

		// Citations survive a reload of the history.
		const hist = await page.evaluate((id) => window.opendot.chat.history(id as `dot_${string}`), dotId);
		const withSources = hist.messages.flatMap((m) => m.toolCalls).find((t) => t.name === "knowledge_search");
		expect(withSources?.sources?.[0]).toMatchObject({ name: "sourdough.md", heading: "Sourdough" });

		// A file outside the folder can't be opened through the chip API.
		await expect(page.evaluate(() => window.opendot.knowledge.open("/etc/hosts"))).rejects.toThrow();
	} finally {
		await app.close();
	}
});

test("Knowledge: the folder list updates when files change and a folder can be removed", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const notes = makeNotes();
		const knowledge = (await page.evaluate(() => window.opendot.connections.list())).find(
			(c) => c.type === "knowledge",
		)!;
		await page.evaluate((p) => window.opendotTest!.knowledgeAddFolder(p), notes);
		await page.evaluate((id) => {
			window.location.hash = `#/connections/${id}`;
		}, knowledge.id);
		await expect(page.getByTestId("knowledge-file-count")).toHaveText("3 files", { timeout: 20000 });

		writeFileSync(join(notes, "new-note.md"), "# New\n\nA fresh note about telescopes and the night sky.\n");
		await expect(page.getByTestId("knowledge-file-count")).toHaveText("4 files", { timeout: 20000 });

		await page.getByRole("button", { name: "Remove" }).first().click();
		await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
		await expect(page.getByText(/No folders yet/)).toBeVisible();
	} finally {
		await app.close();
	}
});
