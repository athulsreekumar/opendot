/// <reference lib="dom" />
// Takes every still from PLAN §7.1 in light and dark, from the real built app with seeded dummy data.
// Usage: tsx shots.ts [--only name1,name2] [--theme light|dark] [--reuse]
import { mkdirSync, renameSync } from "node:fs";
import sharp from "sharp";
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

async function shot(page: Page, name: string, theme: Theme, opts: { blur?: boolean; downscale?: boolean } = {}): Promise<void> {
	if (opts.blur !== false) await blurFocus(page);
	await settle(page, 350);
	const emDash = await page.evaluate(() => document.body.innerText.match(/.{0,30}\u2014.{0,30}/g));
	if (emDash) console.log(`  WARNING em dash visible in ${name}: ${JSON.stringify(emDash)}`);
	const png = join(PNG_DIR, `${name}-${theme}.png`);
	await page.screenshot({ path: png });
	if (opts.downscale) await sharp(png).resize(2880, 1800, { kernel: "lanczos3" }).toFile(`${png}.tmp`).then(() => renameSync(`${png}.tmp`, png));
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
		// Mid-stream: name, icon and tagline are in, the personality text is still arriving.
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
	if (ONLY?.every((n) => n.startsWith("org-"))) return;
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

const ORG_NAMES = ["org-setup", "org-team", "org-plan", "org-board", "org-drawer", "org-summary", "org-skills", "org-chat"];
const ORG_TPS = 400;

/** Scroll the Organisation screen (its own scroll container) to a position or to an element. */
async function orgScroll(page: Page, to: number | { selector: string; block?: "start" | "center" | "end" }): Promise<void> {
	await page.evaluate((t) => {
		const sc = document.querySelector('[data-testid="organisation-screen"]') as HTMLElement | null;
		if (!sc) return;
		if (typeof t === "number") sc.scrollTo(0, t);
		else document.querySelector(t.selector)?.scrollIntoView({ block: t.block ?? "start" });
	}, to);
	await page.waitForTimeout(250);
}

/** Scroll so the project title sits near the top of the frame. */
async function orgToTitle(page: Page, offset = 84): Promise<void> {
	await page.getByRole("heading", { name: SSO_TITLE, level: 2 }).evaluate((el, off) => {
		const sc = document.querySelector('[data-testid="organisation-screen"]') as HTMLElement;
		sc.scrollTo(0, sc.scrollTop + el.getBoundingClientRect().top - off);
	}, offset);
	await page.waitForTimeout(250);
}

/** Resize the window's content area (CSS px). Used to fit more of a tall screen into one frame. */
async function setContent(app: import("playwright-core").ElectronApplication, w: number, h: number): Promise<void> {
	await app.evaluate(({ BrowserWindow }, [cw, ch]) => {
		const win = BrowserWindow.getAllWindows()[0]!;
		win.setResizable(true);
		win.setMinimumSize(1, 1);
		win.setMaximumSize(10000, 10000);
		win.setContentSize(cw!, ch!);
	}, [w, h]);
	await new Promise((r) => setTimeout(r, 900));
}

async function orgTab(page: Page, name: "Projects" | "Team" | "Skills"): Promise<void> {
	await page.getByRole("tab", { name }).click();
	await page.waitForTimeout(500);
}

/** Run C: the first-run screen and the Team tab with a "Software team". */
async function orgTeamFlow(theme: Theme): Promise<void> {
	if (!["org-setup", "org-team"].some(want)) return;
	const { app, page } = await launch({ dataDir: cloneDataDir(await ensureSeed("full", { reuse: true })), tps: ORG_TPS });
	try {
		await setTheme(page, theme);
		await warmConnections(page);
		await go(page, "#/organisation", 1200);
		await page.getByRole("heading", { name: "Build your team" }).waitFor();
		const team = page.getByRole("button", { name: /^Software team/ });
		await team.click();
		await page.waitForTimeout(500);
		await page.getByLabel(/Organisation name/).fill("Northwind Labs");
		await page.waitForTimeout(300);
		if (want("org-setup")) await shot(page, "org-setup", theme);
		await page.getByRole("button", { name: "Create my team" }).click();
		await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
		await orgTab(page, "Team");
		for (const n of ["Engineering", "Product", "Design", "Security", "IT", "Data"]) await page.getByRole("article", { name: n, exact: true }).waitFor();
		await page.waitForTimeout(600);
		await orgScroll(page, 0);
		if (want("org-team")) await shot(page, "org-team", theme);
	} finally {
		await app.close();
	}
}

const PLAN_ZOOM = 0.75;
const SSO_TITLE = "Add single sign-on for customers";
const SSO_BRIEF =
	"Customers should sign in to Northwind Labs with their company account (Okta or Microsoft Entra ID). Ship it this quarter and tell customers when it is live.";

/** Run D: the full team and one project from plan to final report, then SuperDot's chat. */
async function orgProjectFlow(theme: Theme): Promise<void> {
	if (!ORG_NAMES.slice(2).some(want)) return;
	const { app, page } = await launch({
		dataDir: cloneDataDir(await ensureSeed("full", { reuse: true })),
		tps: ORG_TPS,
		env: { OPENDOT_E2E_ORG_CONCURRENCY: "6" },
	});
	try {
		await setTheme(page, theme);
		await warmConnections(page);
		await page.evaluate(() => window.opendot.org.setup({ templateId: "full", name: "Northwind Labs" }));
		await page.waitForTimeout(800);

		if (want("org-skills")) {
			await go(page, "#/organisation", 1000);
			await orgTab(page, "Skills");
			await page.getByRole("region", { name: "Engineering", exact: true }).waitFor();
			await orgScroll(page, 0);
			await shot(page, "org-skills", theme);
			await orgTab(page, "Projects");
		}

		await page.evaluate(() => window.opendotTest!.setFakeScript("org-sso"));
		const id = await page.evaluate(
			([title, brief]) => window.opendot.org.createProject({ title: title!, brief: brief! }).then((p) => p.id),
			[SSO_TITLE, SSO_BRIEF],
		);
		await go(page, `#/organisation/${id}`, 600);
		await page.getByRole("region", { name: "Plan review" }).waitFor({ timeout: 60000 });
		await page.waitForTimeout(800);
		// Plan rows are tall; zoom out so three of them fit (the window stays 1440x900, the text stays sharp at 2x).
		await setContent(app, Math.round(1440 / PLAN_ZOOM), Math.round(900 / PLAN_ZOOM));
		await orgScroll(page, { selector: '[aria-label="Plan review"]', block: "start" });
		await orgToTitle(page, 20);
		if (want("org-plan")) await shot(page, "org-plan", theme, { downscale: true });
		await setContent(app, 1440, 900);

		await page.getByRole("button", { name: "Approve and start" }).click();
		const card = (title: string) => page.locator(`[data-task-id]`).filter({ hasText: title });
		// Mid-flight: Security's review of the login flow and Legal's contract are still pending.
		await page.locator('[data-task-id="t1"][data-status="review"]').waitFor({ timeout: 30000 });
		await page.locator('[data-task-id="t3"][data-status="needs-input"]').waitFor({ timeout: 30000 });
		await page.locator('[data-task-id="t2"][data-status="done"]').waitFor({ timeout: 30000 });
		await page.locator('[data-task-id="t5"][data-status="done"]').waitFor({ timeout: 30000 });
		await page.waitForTimeout(300);
		await orgScroll(page, 0);
		if (want("org-board")) await shot(page, "org-board", theme);

		// Let Security's review of the login flow finish so both themes show the same board behind the drawer.
		await page.locator('[data-task-id="t1"][data-status="done"]').waitFor({ timeout: 60000 });
		await page.waitForTimeout(400);
		await card("Update the onboarding docs").click();
		const drawer = page.getByRole("dialog", { name: "Update the onboarding docs" });
		await drawer.getByLabel("Your answer").waitFor();
		await drawer.getByLabel("Your answer").fill("Cover both. Most of our customers use Okta, but two of the biggest ones are on Microsoft Entra ID.");
		await page.waitForTimeout(500);
		if (want("org-drawer")) await shot(page, "org-drawer", theme, { blur: false });
		// The answer is sent after SuperDot's chat has been photographed (so no task is running in it).
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		// Legal's summary arrives for your review. SuperDot's chat now holds the plan, question and review cards.
		await page.locator('[data-task-id="t4"][data-status="review"]').waitFor({ timeout: 90000 });
		await page.waitForTimeout(800);
		if (want("org-chat")) {
			await openDot(page, "SuperDot");
			await page.getByTestId("org-update-card").filter({ hasText: "Needs your review" }).waitFor();
			await page.waitForTimeout(900);
			await shot(page, "org-chat", theme);
			await go(page, `#/organisation/${id}`, 800);
		}
		await card("Vendor contract").click();
		const review = page.getByRole("dialog", { name: "Vendor contract for the identity provider" });
		await review.getByRole("button", { name: "Approve", exact: true }).click();
		await page.waitForTimeout(600);
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);
		await card("Update the onboarding docs").click();
		const answerBox = drawer.getByLabel("Your answer");
		await answerBox.fill("Cover both. Most of our customers use Okta, but two of the biggest ones are on Microsoft Entra ID.");
		await drawer.getByRole("button", { name: "Send answer" }).click();
		await page.waitForTimeout(500);
		await page.keyboard.press("Escape");

		await page.getByRole("region", { name: "Summary" }).waitFor({ timeout: 90000 });
		await page.waitForTimeout(1200);
		await page.getByLabel("View").getByText("List", { exact: true }).click();
		await page.waitForTimeout(500);
		await orgScroll(page, 0);
		if (want("org-summary")) await shot(page, "org-summary", theme);

	} finally {
		await app.close();
	}
}

for (const theme of THEMES) {
	console.log(`theme: ${theme}`);
	await newDotFlow(theme);
	await mainFlow(theme);
	await orgTeamFlow(theme);
	await orgProjectFlow(theme);
}
