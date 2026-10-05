/// <reference lib="dom" />
// Takes every still from PLAN §7.1 in light and dark, from the real built app with seeded dummy data.
// Usage: tsx shots.ts [--only name1,name2] [--theme light|dark] [--reuse]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { cloneDataDir, launch } from "./lib/app";
import { writeOptimised } from "./lib/images";
import { OUT_DIR, SHOTS_PUBLIC } from "./lib/paths";
import { ensureSeed } from "./lib/seeds";
import { blurFocus, followChat, go, openDot, sendMessage, setTheme, settle, type Theme, waitForText, warmConnections } from "./lib/ui";

const args = process.argv.slice(2);
const arg = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const ONLY = arg("--only")?.split(",");
const THEMES = (arg("--theme") ? [arg("--theme")] : ["light", "dark"]) as Theme[];
const REUSE = args.includes("--reuse");
const PNG_DIR = join(OUT_DIR, "shots");
mkdirSync(PNG_DIR, { recursive: true });
// Slow enough that "mid-stream" frames exist, fast enough to wait for.
const TPS = 30;

const want = (name: string) => !ONLY || ONLY.includes(name);

async function shot(page: Page, name: string, theme: Theme, opts: { blur?: boolean } = {}): Promise<void> {
	if (opts.blur !== false) await blurFocus(page);
	await settle(page, 350);
	const emDash = await page.evaluate(() => document.body.innerText.match(/.{0,30}\u2014.{0,30}/g));
	if (emDash) console.log(`  WARNING em dash visible in ${name}: ${JSON.stringify(emDash)}`);
	const png = join(PNG_DIR, `${name}-${theme}.png`);
	await page.screenshot({ path: png });
	const sizes = await writeOptimised(png, join(SHOTS_PUBLIC, `${name}-${theme}@2x`));
	console.log(`  ${name}-${theme}: avif ${(sizes.avif / 1024).toFixed(0)} KB, webp ${(sizes.webp / 1024).toFixed(0)} KB`);
}

const NEW_DOT_PROMPT = "Watch my inbox and tell me what actually needs me.";

/** Run A: the New Dot flow, on a data dir without Inbox so the new Dot becomes the seventh. */
async function newDotFlow(theme: Theme): Promise<void> {
	const names = ["new-dot-describe", "new-dot-review", "new-dot-edit", "new-dot-created"];
	if (!names.some(want)) return;
	const { app, page } = await launch({ dataDir: cloneDataDir(await ensureSeed("noinbox", { reuse: true })), tps: TPS });
	try {
		await setTheme(page, theme);
		await warmConnections(page);
		await go(page, "#/chats", 800);
		await page.keyboard.press("Control+n");
		await page.locator("#newdot-prompt").waitFor();
		await page.locator("#newdot-prompt").fill(NEW_DOT_PROMPT);
		await page.getByRole("button", { name: /^Gmail/ }).first().click();
		await page.getByRole("button", { name: /^Google Calendar/ }).first().click();
		await page.waitForTimeout(500);
		if (want("new-dot-describe")) await shot(page, "new-dot-describe", theme, { blur: false });

		await page.evaluate(() => window.opendotTest!.setFakeScript("create-inbox"));
		await page.getByRole("button", { name: /create personality/i }).click();
		// Mid-stream: name, emoji and tagline are in, the personality text is still arriving.
		await page.waitForFunction(
			() => {
				const card = document.querySelector('[aria-live="polite"]') as HTMLElement | null;
				return !!card && card.innerText.length > 230 && card.innerText.includes("Reads everything");
			},
			undefined,
			{ timeout: 60000, polling: 50 },
		);
		await page.evaluate(() =>
			[...document.querySelectorAll("button")].find((b) => /create personality/i.test(b.textContent ?? ""))?.scrollIntoView({ block: "end" }),
		);
		await page.waitForTimeout(150);
		if (want("new-dot-review")) await shot(page, "new-dot-review", theme);
		await page.getByRole("button", { name: /create dot/i }).waitFor({ timeout: 60000 });
		await page.waitForTimeout(400);
		if (want("new-dot-edit")) await shot(page, "new-dot-edit", theme);
		await page.getByRole("button", { name: /create dot/i }).click();
		await waitForText(page, "is ready");
		await page.waitForTimeout(900);
		if (want("new-dot-created")) await shot(page, "new-dot-created", theme);
	} finally {
		await app.close();
	}
}

/** Run B: everything else, on the full seed. */
async function mainFlow(theme: Theme): Promise<void> {
	const { app, page } = await launch({ dataDir: cloneDataDir(await ensureSeed("full", { reuse: true })), tps: TPS });
	try {
		await setTheme(page, theme);
		await warmConnections(page);
		await followChat(page);

		if (want("sidebar-full")) {
			await openDot(page, "SuperDot");
			await page.waitForTimeout(500);
			await shot(page, "sidebar-full", theme);
		}

		if (want("chat-streaming")) {
			await openDot(page, "Research");
			await page.evaluate(() => window.opendotTest!.setFakeScript("research-summary"));
			await sendMessage(page, "Which standing desk should I buy? Shortlist three under $600.");
			await waitForText(page, "Dual-motor frames wobble");
			await page.waitForTimeout(900);
			await shot(page, "chat-streaming", theme);
			await waitForText(page, "Confidence: medium");
			await page.waitForTimeout(300);
		}

		if (want("always-on-update")) {
			const inbox = await openDot(page, "Inbox");
			await page.evaluate(() => window.opendotTest!.setFakeScript("inbox-urgent"));
			await page.evaluate(
				(id) =>
					window.opendotTest!.emitEvent(id, "Maya Chen: Q4 planning, need your sign-off on the budget", "Reply needed by 18:00", "high"),
				inbox,
			);
			await waitForText(page, "Want me to draft a reply?");
			await page.waitForTimeout(700);
			await shot(page, "always-on-update", theme);
		}

		if (want("approval-card")) {
			await openDot(page, "Inbox");
			await page.evaluate(() => window.opendotTest!.setFakeScript("approval-send-email"));
			await sendMessage(page, "Tell Maya yes on budget v3. Contractors stay at 38k.");
			await page.getByRole("button", { name: /^deny$/i }).first().waitFor({ timeout: 60000 });
			await page.waitForTimeout(600);
			await shot(page, "approval-card", theme);
			await page.getByRole("button", { name: /allow once/i }).first().click();
			await waitForText(page, "Maya has your approval");
		}

		if (want("superbot-fanout") || want("superbot-answer")) {
			await openDot(page, "SuperDot");
			await page.evaluate(() => window.opendotTest!.setFakeScript("superbot-tomorrow"));
			await sendMessage(page, "What do I need to prepare for tomorrow?");
			if (want("superbot-fanout")) {
				await page.waitForFunction(
					() => [...document.querySelectorAll(".line-clamp-3")].filter((e) => (e as HTMLElement).innerText.trim().length > 60).length >= 3,
					undefined,
					{ timeout: 60000, polling: 50 },
				);
				await page.waitForTimeout(250);
				await shot(page, "superbot-fanout", theme);
			}
			await waitForText(page, "No travel tasks tomorrow");
			await page.waitForTimeout(700);
			if (want("superbot-answer")) await shot(page, "superbot-answer", theme);
		}

		if (want("links-screen")) {
			await go(page, "#/links", 1400);
			await shot(page, "links-screen", theme);
		}
		if (want("connections")) {
			await go(page, "#/connections", 1200);
			await shot(page, "connections", theme);
		}

		// The two screens below show the default model, so point it at a real-looking one first
		// (the scripted model is only ever used for chat, and chat is finished by now).
		if (want("settings-models") || want("dot-info") || want("privacy")) {
			await page.evaluate(async () => {
				const models = await window.opendot.models.listModels();
				const m = models.find((x) => x.providerId === "anthropic" && /sonnet/i.test(x.label)) ?? models.find((x) => x.providerId === "anthropic");
				if (m) await window.opendot.settings.update({ defaultModel: { providerId: m.providerId, modelId: m.modelId } });
			});
		}
		if (want("settings-models")) {
			await go(page, "#/settings/models", 1000);
			await page.evaluate(() => {
				for (const el of document.querySelectorAll("div.rounded-lg")) if ((el as HTMLElement).innerText.startsWith("Fake (tests)")) el.remove();
			});
			await shot(page, "settings-models", theme);
		}
		if (want("privacy")) {
			await go(page, "#/settings/privacy", 900);
			await page.locator("textarea").first().fill("Send the invoice to maya.chen@example.com or call +1 415-555-0134. Card 4111 1111 1111 1111.");
			await page.waitForTimeout(600);
			await shot(page, "privacy", theme);
		}
		if (want("dot-info")) {
			await openDot(page, "Code Buddy");
			await page.getByRole("button", { name: /dot info|info/i }).first().click();
			await page.waitForTimeout(1000);
			// Expand GitHub's tool list (Allow / Ask / Block per tool), then bring the Tools card to the top.
			await page.locator('[data-testid="section-tools"]').getByRole("button", { name: /^6 tools$/ }).click();
			await page.waitForTimeout(300);
			await page.evaluate(() => {
				document.querySelector('[data-testid="section-tools"]')?.scrollIntoView({ block: "start" });
			});
			await shot(page, "dot-info", theme);
		}
	} finally {
		await app.close();
	}
}

for (const theme of THEMES) {
	console.log(`theme: ${theme}`);
	await newDotFlow(theme);
	await mainFlow(theme);
}
