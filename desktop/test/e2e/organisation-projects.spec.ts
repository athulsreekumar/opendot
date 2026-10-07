// Organisation projects, backend only (docs/spec/15-organisation.md §5 to §9): the real app, the scripted fake model,
// driven through window.opendot.org.* (the screens are covered by organisation.spec.ts).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createDot, launchApp, quickSetup } from "./helpers";

test("a project goes from planning to done: plan, question, review round, deliverable and chat cards", async () => {
	// One task at a time keeps the scripted replies in a fixed order.
	const { app, page } = await launchApp({ env: { OPENDOT_E2E_ORG_CONCURRENCY: "1" } });
	try {
		await quickSetup(page);
		const eng = await createDot(page, "inbox", "Engineering");
		const sec = await createDot(page, "inbox", "Security");
		const des = await createDot(page, "inbox", "Design");
		const superId = (await page.evaluate(() => window.opendot.superbot.get())).id;
		await page.evaluate(
			(ids) =>
				window.opendotTest!.writeOrgState({
					created: true,
					name: "Acme",
					members: [
						{ dotId: ids.eng as `dot_${string}`, domain: "engineering", skillIds: [] },
						{ dotId: ids.sec as `dot_${string}`, domain: "security", skillIds: [] },
						{ dotId: ids.des as `dot_${string}`, domain: "design", skillIds: [] },
					],
				}),
			{ eng, sec, des },
		);
		await page.evaluate(() => window.opendotTest!.setFakeScript("org-projects"));

		// Planning: SuperDot's hidden turn calls propose_plan.
		const created = await page.evaluate(() =>
			window.opendot.org.createProject({
				title: "Add single sign-on",
				brief: "Customers sign in with their company account.",
			}),
		);
		expect(created.status).toBe("planning");
		const id = created.id;
		const project = () => page.evaluate((id) => window.opendot.org.project(id), id);
		await expect.poll(async () => (await project()).status, { timeout: 30000 }).toBe("awaiting-approval");
		const planned = await project();
		expect(planned.plannerNote).toContain("Engineering builds the login page");
		expect(planned.tasks.map((t) => [t.id, t.assignee, t.reviewer, t.dependsOn])).toEqual([
			["t1", eng, sec, []],
			["t2", des, undefined, []],
			["t3", eng, undefined, ["t1", "t2"]],
		]);
		expect(
			await page.evaluate(() =>
				window.opendot.org.projects().then((l) => l.map((p) => [p.title, p.status, p.attention])),
			),
		).toEqual([["Add single sign-on", "awaiting-approval", 1]]);
		// The plan can't run before it is approved.
		await expect(page.evaluate((id) => window.opendot.org.pause(id), id)).rejects.toThrow();

		// Running: t1 asks a question first.
		await page.evaluate((id) => window.opendot.org.approve(id), id);
		await expect
			.poll(async () => (await project()).tasks.find((t) => t.id === "t1")?.status, { timeout: 30000 })
			.toBe("needs-input");
		expect((await project()).tasks[0]!.question).toBe("Which identity provider should we use?");
		await page.evaluate((id) => window.opendot.org.answerTask(id, "t1", "Use Okta."), id);

		// The reviewer asks for changes once, then approves; the other tasks follow.
		await expect.poll(async () => (await project()).status, { timeout: 60000 }).toBe("done");
		const done = await project();
		expect(done.tasks.map((t) => t.status)).toEqual(["done", "done", "done"]);
		const t1 = done.tasks[0]!;
		expect(t1.attempt).toBe(2);
		expect(t1.reviews.map((r) => [r.verdict, r.by])).toEqual([
			["changes", sec],
			["approved", sec],
		]);
		expect(t1.reviews[0]!.note).toContain("Add a test for the callback");
		expect(t1.result).toContain("callback test");

		// Tasks started in dependency order.
		const started = done.log.filter((l) => l.kind === "task" && l.text.startsWith("Started")).map((l) => l.text);
		expect(started[0]).toContain("Build the login page");
		expect(started.findIndex((t) => t.includes("Design the sign-in screen"))).toBeGreaterThan(0);
		expect(started.at(-1)).toContain("Write the rollout notes");
		expect(done.summary).toContain("All three tasks are done");

		// The deliverable is a real file in the assignee's workspace.
		const dot = await page.evaluate((id) => window.opendot.dots.get(id as `dot_${string}`), eng);
		expect(t1.deliverables).toEqual([{ kind: "file", title: "login.md", path: `projects/${id}/t1/login.md` }]);
		const file = join(dot.workspaceDir, "projects", id, "t1", "login.md");
		expect(existsSync(file)).toBe(true);
		expect(readFileSync(file, "utf8")).toContain("callback test");

		// The project survives on disk and in a fresh listing.
		const saved = JSON.parse(
			readFileSync(join(dataDirOf(dot.workspaceDir), "organisation", "projects", id, "project.json"), "utf8"),
		);
		expect(saved.status).toBe("done");

		// SuperDot's chat has the cards.
		await expect
			.poll(
				async () => {
					const hist = await page.evaluate(
						(id) => window.opendot.chat.history(id as `dot_${string}`, { limit: 200 }),
						superId,
					);
					return hist.messages.filter((m) => m.orgUpdate?.projectId === id).map((m) => m.orgUpdate!.kind);
				},
				{ timeout: 15000 },
			)
			.toEqual(expect.arrayContaining(["plan-ready", "needs-input", "done"]));
		await expect(page.evaluate((id) => window.opendot.org.deleteProject(id), id)).resolves.toBeUndefined();
		expect(await page.evaluate(() => window.opendot.org.projects())).toEqual([]);
	} finally {
		await app.close();
	}
});

/** <dataDir>/dots/<id>/workspace → <dataDir> */
function dataDirOf(workspaceDir: string): string {
	return join(workspaceDir, "..", "..", "..");
}
