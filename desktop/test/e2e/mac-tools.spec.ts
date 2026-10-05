// The model must actually receive This Mac's tools when a Dot is granted the connection.
import { expect, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, send } from "./helpers";

/** Tool names the model was offered (the captured context lists each tool as {"name": …}). */
function toolNames(ctx: unknown): string[] {
	return [...JSON.stringify(ctx).matchAll(/"name":"([a-z_]+)"/g)].map((m) => m[1]!);
}

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
		for (const n of ["read", "ls", "grep", "find", "write", "edit", "bash", "mac_calendar_events", "mac_notes_search"])
			expect(names).toContain(n);
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
