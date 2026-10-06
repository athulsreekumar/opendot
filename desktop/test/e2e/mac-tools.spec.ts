// The model must actually receive This Mac's tools when a Dot is granted the connection.
import { expect, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, send } from "./helpers";

const WIN = process.platform === "win32";

/** Tool names the model was offered (the captured context lists each tool as {"name": …}). */
function toolNames(ctx: unknown): string[] {
	return [...JSON.stringify(ctx).matchAll(/"name":"([a-z_]+)"/g)].map((m) => m[1]!);
}

test("the built-in computer connection is named for this OS and only offers what exists here", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const mac = (await page.evaluate(() => window.opendot.connections.list())).find((c) => c.type === "mac")!;
		expect(mac.label).toBe(WIN ? "This PC" : "This Mac");
		for (const f of ["files", "shell", "screen", "clipboard", "notifications", "open"])
			expect(mac.features).toContain(f);
		for (const f of ["calendar", "reminders", "contacts", "notes"]) expect(mac.features.includes(f)).toBe(!WIN);
	} finally {
		await app.close();
	}
});

test("a Dot granted This Mac gets file, shell and Mac tools", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		await page.evaluate(async (id) => {
			const mac = (await window.opendot.connections.list()).find((c) => c.type === "mac")!;
			const d = await window.opendot.dots.get(id as `dot_${string}`);
			await window.opendot.dots.update(d.id, {
				grants: [...d.grants.filter((g) => g.connectionId !== mac.id), { connectionId: mac.id, toolRules: {} }],
			});
		}, dotId);
		await openDot(page, dotId);
		await page.evaluate(() => window.opendotTest!.setFakeScript("pii-capture"));
		await send(page, "list my files");
		await expect
			.poll(async () => (await page.evaluate(() => window.opendotTest!.getCaptured())).length)
			.toBeGreaterThan(0);
		const ctx = JSON.parse((await page.evaluate(() => window.opendotTest!.getCaptured()))[0]!);
		const names = toolNames(ctx);
		// On Windows the shell needs Git for Windows (preinstalled on GitHub's runners) and there is no Calendar or Notes.
		const shell = await page.evaluate(async () => (await window.opendot.app.info()).shellAvailable);
		const expected = [
			"read",
			"ls",
			"grep",
			"find",
			"write",
			"edit",
			"mac_clipboard_read",
			...(shell ? ["bash"] : []),
			...(WIN ? [] : ["mac_calendar_events", "mac_notes_search"]),
		];
		for (const n of expected) expect(names).toContain(n);
		if (!shell) expect(names).not.toContain("bash");
		if (WIN) expect(names.some((n) => /^mac_(calendar|reminders|contacts|notes)/.test(n))).toBe(false);
	} finally {
		await app.close();
	}
});

test("a Dot granted only Files gets file tools but no shell", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Reader");
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
		await openDot(page, dotId);
		await page.evaluate(() => window.opendotTest!.setFakeScript("pii-capture"));
		await send(page, "what can you do");
		await expect
			.poll(async () => (await page.evaluate(() => window.opendotTest!.getCaptured())).length)
			.toBeGreaterThan(0);
		const names = toolNames(JSON.parse((await page.evaluate(() => window.opendotTest!.getCaptured()))[0]!));
		for (const n of ["read", "ls", "write", "edit"]) expect(names).toContain(n);
		expect(names).not.toContain("bash");
		expect(names.some((n) => n.startsWith("mac_"))).toBe(false);
	} finally {
		await app.close();
	}
});

test("a Dot without This Mac gets no file or shell tools", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Plain");
		await page.evaluate(async (id) => {
			const mac = (await window.opendot.connections.list()).find((c) => c.type === "mac")!;
			const d = await window.opendot.dots.get(id as `dot_${string}`);
			await window.opendot.dots.update(d.id, { grants: d.grants.filter((g) => g.connectionId !== mac.id) });
		}, dotId);
		await openDot(page, dotId);
		await page.evaluate(() => window.opendotTest!.setFakeScript("pii-capture"));
		await send(page, "hello");
		await expect
			.poll(async () => (await page.evaluate(() => window.opendotTest!.getCaptured())).length)
			.toBeGreaterThan(0);
		const names = toolNames(JSON.parse((await page.evaluate(() => window.opendotTest!.getCaptured()))[0]!));
		for (const n of ["read", "write", "edit", "bash", "ls"]) expect(names).not.toContain(n);
		expect(names).toContain("remember");
	} finally {
		await app.close();
	}
});
