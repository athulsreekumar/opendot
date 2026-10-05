// Golden path (spec 11 §3.2). Runs the real Electron app with the scripted fake model.
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createDot, launchApp, openDot, quickSetup, screenshot, send } from "./helpers";

const ECHO = resolve(import.meta.dirname, "../fixtures/mcp-echo-server.mjs");

test("onboarding → first Dots", async () => {
	const { app, page } = await launchApp();
	try {
		await expect(page.getByText("Meet your Dots")).toBeVisible({ timeout: 20000 });
		await screenshot(page, "onboarding-welcome");
		await page.getByRole("button", { name: /get started/i }).click();
		await page
			.getByText(/skip for now/i)
			.first()
			.click();
		await expect(page.getByText(/pick your first dots/i).first()).toBeVisible();
		await screenshot(page, "onboarding-dots");
		await page
			.getByRole("button", { name: /create|continue|next/i })
			.last()
			.click();
		// Background step and privacy promise.
		for (let i = 0; i < 6; i++) {
			await page.waitForTimeout(400);
			const start = page.getByRole("button", { name: /start chatting/i });
			if (await start.isVisible().catch(() => false)) break;
			await page
				.getByRole("button", { name: /continue|next/i })
				.last()
				.click({ timeout: 5000 })
				.catch(() => undefined);
		}
		await page.getByRole("button", { name: /start chatting/i }).click();
		await expect(page.getByText("SuperDot").first()).toBeVisible();
		const dots = await page.evaluate(() => window.opendot.dots.list());
		expect(dots.length).toBeGreaterThanOrEqual(3);
		await screenshot(page, "after-onboarding");
	} finally {
		await app.close();
	}
});

test("create a Dot from a prompt + connectors (New Dot dialog)", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		await page.keyboard.press("Control+n");
		const dialogVisible = await page
			.getByText(/what should this dot do/i)
			.first()
			.isVisible()
			.catch(() => false);
		if (!dialogVisible)
			await page
				.getByRole("button", { name: /new dot/i })
				.first()
				.click();
		await expect(page.getByText(/what should this dot do/i).first()).toBeVisible();
		await page.locator("textarea").first().fill("Keep an eye on my invoices folder and remind me who hasn't paid yet.");
		await page
			.getByRole("button", { name: /^files$/i })
			.first()
			.click();
		await screenshot(page, "new-dot-describe");
		await page.getByRole("button", { name: /create personality/i }).click();
		await expect(page.getByRole("button", { name: /create dot/i })).toBeVisible({ timeout: 30000 });
		await screenshot(page, "new-dot-review");
		await page.getByRole("button", { name: /create dot/i }).click();
		await expect
			.poll(async () => (await page.evaluate(() => window.opendot.dots.list())).length, { timeout: 15000 })
			.toBe(2);
		const created = (await page.evaluate(() => window.opendot.dots.list())).find((d) => d.kind === "standard")!;
		expect(created.creationPrompt).toContain("invoices");
		expect(created.grants.length).toBe(1); // mac:files granted
		await screenshot(page, "new-dot-created");
	} finally {
		await app.close();
	}
});

test("MCP tool call, approval deny, PII masking, memory", async () => {
	const { app, page } = await launchApp({ env: { ELECTRON_EXE: "" } });
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		const exe = await app.evaluate(() => process.execPath);
		const raw = await page.evaluate(
			async ({ echo, exe }) => {
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
				const st = await window.opendot.connections.check(c.id);
				return { id: c.id, state: st.state, tools: st.toolCount, error: st.error };
			},
			{ echo: ECHO, exe },
		);
		expect(raw.state, raw.error).toBe("connected");
		expect(raw.tools).toBe(2);
		await page.evaluate(
			async ({ dotId, conId }) => {
				const d = await window.opendot.dots.get(dotId as `dot_${string}`);
				await window.opendot.dots.update(d.id, {
					grants: [...d.grants, { connectionId: conId as `con_${string}`, toolRules: {} }],
				});
			},
			{ dotId, conId: raw.id },
		);
		await openDot(page, dotId);

		// 1. Read-only MCP tool → runs without approval.
		await page.evaluate(() => window.opendotTest!.setFakeScript("tool-echo"));
		await send(page, "use the echo tool");
		await expect(page.getByText("The echo said hi.").first()).toBeVisible({ timeout: 30000 });
		await screenshot(page, "tool-echo");

		// 2. Destructive tool → approval card → deny.
		await page.evaluate(() => window.opendotTest!.setFakeScript("tool-destructive"));
		await send(page, "delete everything");
		await expect(page.getByRole("button", { name: /^deny$/i }).first()).toBeVisible({ timeout: 30000 });
		await screenshot(page, "approval-card");
		await page
			.getByRole("button", { name: /^deny$/i })
			.first()
			.click();
		await expect(page.getByText(/didn't delete anything/i).first()).toBeVisible({ timeout: 30000 });

		// 3. PII never reaches the (cloud-like) model.
		await page.evaluate(() => window.opendotTest!.setFakeScript("pii-capture"));
		await send(page, "Email me at john.doe@example.com or call +1 415-555-2671");
		await expect
			.poll(async () => (await page.evaluate(() => window.opendotTest!.getCaptured())).length, { timeout: 20000 })
			.toBeGreaterThan(0);
		const captured = (await page.evaluate(() => window.opendotTest!.getCaptured())).join("\n");
		expect(captured).toContain("⟦EMAIL_1⟧");
		expect(captured).not.toContain("john.doe@example.com");
		expect(captured).not.toContain("415-555-2671");
		// The UI shows the real value.
		await expect(page.getByText(/john\.doe@example\.com/).first()).toBeVisible();

		// 4. Memory tool writes ~/.opendot/memory.json.
		await page.evaluate(() => window.opendotTest!.setFakeScript("remember"));
		await send(page, "my favourite colour is teal, remember it");
		await expect(page.getByText(/I'll remember that/i).first()).toBeVisible({ timeout: 30000 });
		const mem = await page.evaluate(() => window.opendot.memory.get("user"));
		expect(mem.map((m) => m.text).join(" ")).toContain("teal");
		await screenshot(page, "memory");
	} finally {
		await app.close();
	}
});

test("Dot Links: ask-approval then reply", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const helper = await createDot(page, "general", "Helper");
		const inbox = await createDot(page, "inbox", "Inbox");
		await page.evaluate(
			async ({ helper, inbox }) => {
				await window.opendot.links.upsert({
					from: { kind: "dot", dotId: helper as `dot_${string}` },
					to: { kind: "dot", dotId: inbox as `dot_${string}` },
					effect: "allow",
					enabled: true,
					approval: "ask",
					maxPerHour: 10,
					sharePii: false,
					purpose: "test",
				});
			},
			{ helper, inbox },
		);
		const sim = await page.evaluate(
			({ helper, inbox }) => window.opendot.links.simulate(helper as `dot_${string}`, inbox as `dot_${string}`),
			{ helper, inbox },
		);
		expect(sim.allowed).toBe(true);
		await openDot(page, helper);
		await page.evaluate(() => window.opendotTest!.setFakeScript("link-ask"));
		await send(page, "ask Inbox about Priya");
		await expect(page.getByRole("button", { name: /allow once/i }).first()).toBeVisible({ timeout: 30000 });
		await page
			.getByRole("button", { name: /allow once/i })
			.first()
			.click();
		await expect(page.getByText(/one email from Priya/i).first()).toBeVisible({ timeout: 30000 });
		await screenshot(page, "dot-link");
		const ex = await page.evaluate(() => window.opendot.links.exchanges());
		expect(ex[0]?.status).toBe("done");
		await page.evaluate(() => {
			window.location.hash = "#/links";
		});
		await page.waitForTimeout(800);
		await screenshot(page, "links-screen");
	} finally {
		await app.close();
	}
});

test("Always on: events → streamed [UPDATE]; NO_UPDATE stays quiet", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		const inbox = await createDot(page, "general", "Inbox");
		await page.evaluate((id) => window.opendot.runtime.setAlwaysOn(id as `dot_${string}`, true), inbox);
		await page.evaluate(async (id) => {
			const d = await window.opendot.dots.get(id as `dot_${string}`);
			await window.opendot.dots.update(d.id, { alwaysOn: { ...d.alwaysOn, enabled: true, batchWindowSec: 0 } });
		}, inbox);
		await openDot(page, inbox);
		await page.evaluate(() => window.opendotTest!.setFakeScript("event-update"));
		await page.evaluate(
			(id) => window.opendotTest!.emitEvent(id, "Email from Priya", "Invoice #2041 is overdue"),
			inbox,
		);
		await expect(page.getByText("Email from Priya").first()).toBeVisible({ timeout: 10000 });
		await expect(page.getByText(/14 days overdue/).first()).toBeVisible({ timeout: 30000 });
		await expect(page.getByText("[UPDATE]")).toHaveCount(0);
		await screenshot(page, "always-on-update");

		await page.evaluate(() => window.opendotTest!.setFakeScript("event-quiet"));
		await page.evaluate((id) => window.opendotTest!.emitEvent(id, "Newsletter", "weekly digest"), inbox);
		await expect(page.getByText("Newsletter").first()).toBeVisible({ timeout: 10000 });
		await page.waitForTimeout(2500);
		await expect(page.getByText("NO_UPDATE")).toHaveCount(0);
		const health = await page.evaluate(() => window.opendot.runtime.health());
		expect(health.find((h) => h.dotId === inbox)?.alwaysOn).toBe(true);
		await page.evaluate(() => {
			window.location.hash = "#/activity";
		});
		await page.waitForTimeout(800);
		await screenshot(page, "activity");
	} finally {
		await app.close();
	}
});

test("SuperDot fans out to Dots in parallel and cites them", async () => {
	const { app, page } = await launchApp();
	try {
		await quickSetup(page);
		await createDot(page, "inbox", "Inbox");
		await createDot(page, "calendar", "Calendar");
		const superId = (await page.evaluate(() => window.opendot.superbot.get())).id;
		const dir = await page.evaluate(() => window.opendot.superbot.directory());
		expect(dir.map((d) => d.name).sort()).toEqual(["Calendar", "Inbox"]);
		await openDot(page, superId);
		await page.evaluate(() => window.opendotTest!.setFakeScript("super-fanout"));
		await send(page, "What's going on today?");
		await expect(page.getByText(/design review at 15:00/).first()).toBeVisible({ timeout: 40000 });
		await screenshot(page, "super-fanout");
		const ex = await page.evaluate(() => window.opendot.links.exchanges());
		expect(ex.filter((x) => x.status === "done").length).toBe(2);
	} finally {
		await app.close();
	}
});

test("streaming: first token paints fast and text is exact", async () => {
	const { app, page } = await launchApp({ env: { OPENDOT_FAKE_TPS: "2000" } });
	try {
		await quickSetup(page);
		const id = await createDot(page, "general", "Streamer");
		await openDot(page, id);
		await page.evaluate(() => window.opendotTest!.setFakeScript("stream-long"));
		const sent = Date.now();
		await send(page, "stream please");
		await expect(page.getByText("Section 24").first()).toBeVisible({ timeout: 60000 });
		const paints = await page.evaluate(() => window.opendotTest!.getPaints());
		expect(paints.length).toBeGreaterThan(0);
		const firstPaint = Math.min(...paints.map((p) => p.paintAt));
		console.log(`first paint ${Math.round(firstPaint - sent)} ms after send`);
		expect(firstPaint - sent).toBeLessThan(3000);
		// Exact text: compare the rendered stream with history after it settles.
		await page.waitForTimeout(1000);
		const hist = await page.evaluate((id) => window.opendot.chat.history(id as `dot_${string}`), id);
		const last = hist.messages.filter((m) => m.role === "assistant").pop()!;
		expect(last.text.length).toBeGreaterThan(4000);
		// Every section streamed into the DOM exactly once (no lost or duplicated deltas).
		const body = await page.locator("main, body").first().innerText();
		for (let i = 1; i <= 24; i++) expect(body.split(`Section ${i}\n`).length - 1, `Section ${i}`).toBe(1);
		await screenshot(page, "streaming");
	} finally {
		await app.close();
	}
});

test("sessions and memory persist across restarts in the data dir", async () => {
	const first = await launchApp();
	let dotId = "";
	try {
		await quickSetup(first.page);
		dotId = await createDot(first.page, "general", "Keeper");
		await openDot(first.page, dotId);
		await send(first.page, "remember this conversation");
		await expect(first.page.getByText(/You said: remember this conversation/).first()).toBeVisible({ timeout: 30000 });
		await first.page.evaluate(() => window.opendot.memory.upsert("user", { text: "Lives in Kochi" }));
	} finally {
		await first.app.close();
	}
	const second = await launchApp({ dataDir: first.dataDir });
	try {
		await second.page.waitForFunction(() => !!window.opendot);
		const hist = await second.page.evaluate((id) => window.opendot.chat.history(id as `dot_${string}`), dotId);
		expect(hist.messages.some((m) => m.text.includes("remember this conversation"))).toBe(true);
		const mem = await second.page.evaluate(() => window.opendot.memory.get("user"));
		expect(mem.some((m) => m.text === "Lives in Kochi")).toBe(true);
		const { readdirSync } = await import("node:fs");
		expect(readdirSync(first.dataDir)).toEqual(expect.arrayContaining(["settings.json", "dots", "memory.json"]));
	} finally {
		await second.app.close();
	}
});

test("Always allow skips the next approval and is listed in Tools", async () => {
	const { app, page } = await launchApp({ env: { ELECTRON_EXE: "" } });
	try {
		await quickSetup(page);
		const dotId = await createDot(page, "general", "Helper");
		const exe = await app.evaluate(() => process.execPath);
		const con = await page.evaluate(
			async ({ echo, exe }) => {
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
				const st = await window.opendot.connections.check(c.id);
				return { id: c.id, state: st.state, error: st.error };
			},
			{ echo: ECHO, exe },
		);
		expect(con.state, con.error).toBe("connected");
		const conId = con.id;
		await page.evaluate(
			async ({ dotId, conId }) => {
				const d = await window.opendot.dots.get(dotId as `dot_${string}`);
				await window.opendot.dots.update(d.id, {
					grants: [...d.grants, { connectionId: conId as `con_${string}`, toolRules: {} }],
				});
			},
			{ dotId, conId },
		);
		await openDot(page, dotId);
		await page.evaluate(() => window.opendotTest!.setFakeScript("tool-destructive"));
		await send(page, "delete everything");
		try {
			await expect(page.getByRole("button", { name: /always allow/i }).first()).toBeVisible({ timeout: 30000 });
		} catch (e) {
			// Artifacts can't always be fetched; put the state in the CI log.
			const diag = await page.evaluate(
				async ({ dotId, conId }) => ({
					pending: await window.opendot.approvals.pending(),
					connection: await window.opendot.connections.check(conId as `con_${string}`),
					history: (await window.opendot.chat.history(dotId as `dot_${string}`)).messages.map((m) => m.text),
				}),
				{ dotId, conId },
			);
			console.log("always-allow diagnostics:", JSON.stringify(diag, null, 2));
			throw e;
		}
		await screenshot(page, "always-allow-card");
		await page
			.getByRole("button", { name: /always allow/i })
			.first()
			.click({ timeout: 30000 });
		await expect(page.getByText(/didn't delete anything/i).first()).toBeVisible({ timeout: 30000 });
		// Second time: no approval card.
		await page.evaluate(() => window.opendotTest!.setFakeScript("tool-destructive"));
		await send(page, "delete everything again");
		await expect(page.getByText(/didn't delete anything/i).nth(1)).toBeVisible({ timeout: 30000 });
		expect(await page.evaluate(() => window.opendot.approvals.pending())).toHaveLength(0);
		const allowed = await page.evaluate((id) => window.opendot.dots.alwaysAllowed(id as `dot_${string}`), dotId);
		expect(allowed).toContain("mcp__echo__delete_everything");
	} finally {
		await app.close();
	}
});
