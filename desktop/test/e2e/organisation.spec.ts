// Organisation, through the screens only (docs/spec/15-organisation.md §10): the real app, the scripted fake model
// (test/fixtures/fake-scripts/org-ui.json). The backend alone is covered by organisation-projects.spec.ts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { launchApp, quickSetup, screenshot as shoot } from "./helpers";

/** Screenshots start at the top of the screen, so they show the header and the first rows. */
const screenshot = async (page: Page, name: string) => {
	await page.evaluate(() => document.querySelector('[data-testid="organisation-screen"]')?.scrollTo(0, 0));
	await shoot(page, name);
};

const TEAM = ["Engineering", "Product", "Design", "Security", "Marketing", "Finance", "Admin"];

test("Organisation: set up a team, plan, review, run, answer, review and finish a project from the screens", async () => {
	const { app, page, dataDir } = await launchApp();
	try {
		await quickSetup(page);
		const nav = page.getByRole("navigation", { name: "Main" });
		const orgButton = nav.getByRole("button", { name: "Organisation" });
		const railBadge = orgButton.locator("..").getByText(/^\d+$/);
		const goTab = async (name: "Projects" | "Team" | "Skills") => {
			await page.getByRole("tab", { name }).click();
			await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
		};
		const task = (title: string) => page.getByRole("button", { name: new RegExp(`^${title}`) });
		const column = (name: string) => page.getByRole("region", { name, exact: true });

		// ── 1. Set up the team from a template ──
		await orgButton.click();
		await expect(page.getByRole("heading", { name: "Build your team" })).toBeVisible();
		const startup = page.getByRole("button", { name: /^Startup/ });
		await startup.click();
		await expect(startup).toHaveAttribute("aria-pressed", "true");
		await expect(page.getByRole("button", { name: /^Full/ })).toHaveAttribute("aria-pressed", "false");
		await screenshot(page, "org-setup");
		await page.getByRole("button", { name: "Create my team" }).click();
		await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
		await expect(page.getByText("Your team is ready")).toBeVisible();
		await expect(page.getByText("No projects yet")).toBeVisible();

		// The Team tab shows one card per domain, with the domain's skills on it.
		await goTab("Team");
		for (const name of TEAM) await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
		const engineering = page.getByRole("article", { name: "Engineering", exact: true });
		await expect(engineering.getByText("Ship a change")).toBeVisible();
		await expect(
			page.getByRole("article", { name: "Security", exact: true }).getByText("Review a design for threats"),
		).toBeVisible();
		await screenshot(page, "org-team");

		// The members are ordinary Dots in the chat list.
		await nav.getByRole("button", { name: "Chats" }).click();
		for (const name of TEAM)
			await expect(page.getByRole("button", { name: new RegExp(`^${name}`) }).first()).toBeVisible();

		// Skills tab: built-ins are listed and read-only.
		await orgButton.click();
		await goTab("Skills");
		await expect(page.getByRole("region", { name: "Engineering", exact: true })).toBeVisible();
		await expect(page.getByText("Built-in").first()).toBeVisible();
		await screenshot(page, "org-skills");
		await page.getByRole("button", { name: /Ship a change/ }).click();
		const skillDialog = page.getByRole("dialog", { name: "Ship a change" });
		await expect(skillDialog.getByText("Built-in")).toBeVisible();
		await expect(skillDialog.getByRole("button", { name: "Duplicate to edit" })).toBeVisible();
		await expect(skillDialog.getByRole("button", { name: "Save skill" })).toHaveCount(0);
		await expect(skillDialog.getByRole("textbox")).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(skillDialog).toHaveCount(0);

		// ── 2. A new project: planning, then the scripted plan ──
		await page.evaluate(() => window.opendotTest!.setFakeScript("org-ui"));
		await goTab("Projects");
		await page.getByRole("button", { name: "New project" }).first().click();
		const newDialog = page.getByRole("dialog", { name: "New project" });
		await newDialog.getByLabel("Title").fill("Add single sign-on");
		await expect(newDialog.getByRole("button", { name: "Create project" })).toBeDisabled();
		await newDialog.getByLabel("What do you need?").fill("Customers sign in with their company account.");
		await newDialog.getByRole("button", { name: "Create project" }).click();
		await expect(page.getByRole("heading", { name: "Add single sign-on", level: 2 })).toBeVisible();
		await expect(page.getByRole("status", { name: "SuperDot is planning" })).toBeVisible();
		await screenshot(page, "org-planning");
		await expect(page.getByRole("region", { name: "Plan review" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("Engineering builds the login page")).toBeVisible();
		await expect(railBadge).toHaveText("1");

		// ── 3. Plan review: edit a title, change a reviewer, break the plan, fix it, approve ──
		const row = (n: number) => page.locator(`li[aria-label="Task ${n}"]`);
		for (const n of [1, 2, 3, 4]) await expect(row(n)).toBeVisible();
		await expect(row(1).getByLabel("Title")).toHaveValue("Build the login page");
		await expect(row(1).getByRole("combobox", { name: "Assignee for task 1" })).toContainText("Engineering");
		await expect(row(1).getByRole("combobox", { name: "Reviewer for task 1" })).toContainText("Security");
		await row(3).getByLabel("Title").fill("Write the rollout notes for support");
		await row(2).getByRole("combobox", { name: "Reviewer for task 2" }).click();
		await page.getByRole("option", { name: "Me" }).click();
		await expect(row(2).getByRole("combobox", { name: "Reviewer for task 2" })).toContainText("Me");
		await screenshot(page, "org-plan-review");

		// Task 1 can't depend on task 3, which already depends on task 1.
		const approve = page.getByRole("button", { name: "Approve and start" });
		await row(1).getByLabel("Write the rollout notes for support").check();
		await expect(page.getByText("The tasks depend on each other in a circle.")).toBeVisible();
		await expect(approve).toBeDisabled();
		await expect(page.getByText("Fix 1 problem to continue.")).toBeVisible();
		await screenshot(page, "org-plan-problem");
		await row(1).getByLabel("Write the rollout notes for support").uncheck();
		await expect(page.getByText("The tasks depend on each other in a circle.")).toHaveCount(0);
		await expect(approve).toBeEnabled();
		await page.getByRole("button", { name: "Save changes" }).click();
		await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
		const saved = await page.evaluate(() => window.opendot.org.projects().then((l) => l[0]!.id));
		const project = () => page.evaluate((id) => window.opendot.org.project(id), saved);
		expect((await project()).tasks.map((t) => t.title)).toContain("Write the rollout notes for support");
		expect((await project()).tasks[1]!.reviewer).toBe("human");
		await approve.click();

		// ── 4. The board: dependency order, a question, a Dot review, a human review ──
		await expect(page.getByRole("region", { name: "Tasks" })).toBeVisible();
		await expect(task("Write the rollout notes for support")).toBeVisible();
		// The three independent tasks start together; the rollout notes wait for the other two.
		await expect(column("To do").getByRole("button", { name: /^Write the rollout notes for support/ })).toBeVisible();
		await expect(column("Done").getByRole("button", { name: /^Check the launch budget/ })).toBeVisible({
			timeout: 30_000,
		});
		await expect(column("In review").getByRole("button", { name: /^Design the sign-in screen/ })).toBeVisible({
			timeout: 30_000,
		});
		await expect(column("In progress").getByRole("button", { name: /^Build the login page/ })).toContainText(
			"Waiting for you",
		);
		await expect(railBadge).toHaveText("2");
		await screenshot(page, "org-board");

		// Answer the question in the drawer.
		await task("Build the login page").click();
		const drawer = page.getByRole("dialog", { name: "Build the login page" });
		await expect(drawer.getByText("Which identity provider should we use?")).toBeVisible();
		await screenshot(page, "org-drawer-question");
		await drawer.getByLabel("Your answer").fill("Use Okta.");
		await drawer.getByRole("button", { name: "Send answer" }).click();
		await expect(drawer.getByText("Which identity provider should we use?")).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(drawer).toHaveCount(0);

		// You approve the design task yourself.
		await task("Design the sign-in screen").click();
		const review = page.getByRole("dialog", { name: "Design the sign-in screen" });
		await expect(review.getByText("The sign-in screen has one field and one button.")).toBeVisible();
		await review.getByRole("button", { name: "Approve", exact: true }).click();
		await expect(review.getByText("Approved", { exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(review).toHaveCount(0);
		await expect(column("Done").getByRole("button", { name: /^Design the sign-in screen/ })).toBeVisible({
			timeout: 30_000,
		});

		// The Dot reviewer asks for changes once and then approves (round 2 on the card).
		await expect(column("Done").getByRole("button", { name: /^Build the login page/ })).toContainText("Round 2", {
			timeout: 60_000,
		});
		await expect(column("Done").getByRole("button", { name: /^Write the rollout notes for support/ })).toBeVisible({
			timeout: 60_000,
		});

		// Summary card, a finished project.
		await expect(page.getByRole("region", { name: "Summary" })).toContainText("All four tasks are done", {
			timeout: 60_000,
		});
		await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();
		await expect(railBadge).toHaveCount(0);
		await screenshot(page, "org-summary");

		// Deliverable, review history and the Open button.
		await task("Build the login page").click();
		const done = page.getByRole("dialog", { name: "Build the login page" });
		await expect(done.getByText("login.md", { exact: true })).toBeVisible();
		await expect(done.getByRole("button", { name: "Open login.md" })).toBeVisible();
		await expect(done.getByText("Changes asked for")).toBeVisible();
		await expect(done.getByText("Add a test for the callback.")).toBeVisible();
		await expect(done.getByText("Approved", { exact: true })).toBeVisible();
		await screenshot(page, "org-drawer-done");
		await page.keyboard.press("Escape");
		await expect(done).toHaveCount(0);

		// What the backend ended up with matches what the screens showed.
		const p = await project();
		expect(p.status).toBe("done");
		expect(p.tasks.map((t) => t.status)).toEqual(["done", "done", "done", "done"]);
		const at = (id: string) => p.tasks.find((t) => t.id === id)!;
		expect(at("t1").reviews.map((r) => r.verdict)).toEqual(["changes", "approved"]);
		expect(at("t2").reviews.map((r) => [r.verdict, r.by])).toEqual([["approved", "human"]]);
		const before = (a: string | undefined, b: string | undefined) => (a ?? "") <= (b ?? "");
		// Independent tasks overlapped: Design and Finance started before Engineering finished its first task.
		expect(before(at("t2").startedAt, at("t1").finishedAt)).toBe(true);
		expect(before(at("t4").startedAt, at("t1").finishedAt)).toBe(true);
		// The dependent task started only after both of its dependencies finished.
		expect(before(at("t1").finishedAt, at("t3").startedAt)).toBe(true);
		expect(before(at("t2").finishedAt, at("t3").startedAt)).toBe(true);
		const eng = await page.evaluate((id) => window.opendot.dots.get(id as `dot_${string}`), at("t1").assignee);
		expect(existsSync(join(eng.workspaceDir, "projects", saved, "t1", "login.md"))).toBe(true);
		expect(readFileSync(join(eng.workspaceDir, "projects", saved, "t1", "login.md"), "utf8")).toContain(
			"callback test",
		);
		expect(existsSync(join(dataDir, "organisation", "projects", saved, "project.json"))).toBe(true);

		// ── 5. SuperDot's chat has the update cards ──
		await nav.getByRole("button", { name: "Chats" }).click();
		await page
			.getByRole("button", { name: /^SuperDot/ })
			.first()
			.click();
		const cards = page.getByTestId("org-update-card");
		await expect(cards.filter({ hasText: "Plan ready" })).toHaveCount(1, { timeout: 15_000 });
		await expect(cards.filter({ hasText: "Waiting for you" }).first()).toBeVisible();
		await expect(cards.filter({ hasText: "Needs your review" }).first()).toBeVisible();
		// The cards keep the order things happened in.
		const kinds = (await cards.allInnerTexts()).map(
			(t) => /Plan ready|Needs your review|Waiting for you|Done/.exec(t)?.[0],
		);
		expect(kinds[0]).toBe("Plan ready");
		expect(kinds.at(-1)).toBe("Done");
		const doneCard = cards.filter({ hasText: "Done" }).last();
		await expect(doneCard).toBeVisible();
		await screenshot(page, "org-chat-cards");
		await doneCard.getByRole("button", { name: "Open project" }).click();
		await expect(page).toHaveURL(new RegExp(`#/organisation/${saved}$`));
		await expect(page.getByRole("heading", { name: "Add single sign-on", level: 2 })).toBeVisible();

		// ── 6. A second project: pause, resume, cancel ──
		await page.getByRole("button", { name: "All projects" }).click();
		await page.getByRole("button", { name: "New project" }).first().click();
		await newDialog.getByLabel("Title").fill("Onboard a new vendor");
		await newDialog.getByLabel("What do you need?").fill("We need a signed contract and an announcement.");
		await newDialog.getByRole("button", { name: "Create project" }).click();
		await expect(page.getByRole("region", { name: "Plan review" })).toBeVisible({ timeout: 30_000 });
		await expect(railBadge).toHaveText("1");
		await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
		await approve.click();
		// Your own task is waiting for you, so the board says so and the rail counts it.
		await expect(column("To do").getByRole("button", { name: /^Sign the vendor contract/ })).toContainText("Your turn");
		await expect(railBadge).toHaveText("1");
		await page.getByRole("button", { name: "Pause" }).click();
		await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
		await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
		await screenshot(page, "org-paused");
		await page.getByRole("button", { name: "Resume" }).click();
		await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
		await page.getByRole("button", { name: "Cancel project" }).click();
		const confirm = page.getByRole("dialog", { name: "Cancel this project?" });
		await confirm.getByRole("button", { name: "Keep it" }).click();
		await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
		await page.getByRole("button", { name: "Cancel project" }).click();
		await confirm.getByRole("button", { name: "Cancel project" }).click();
		await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
		await expect(railBadge).toHaveCount(0);

		// The list shows both projects with their states.
		await page.getByRole("button", { name: "All projects" }).click();
		await expect(page.getByRole("button", { name: /Add single sign-on/ })).toContainText("Done");
		await expect(page.getByRole("button", { name: /Onboard a new vendor/ })).toContainText("Cancelled");
		await screenshot(page, "org-projects");
	} finally {
		await app.close();
	}
});
