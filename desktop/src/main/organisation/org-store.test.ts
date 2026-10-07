import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { OrgStore } from "./org-store";

let root: string;
beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "org-store-")));
});
afterEach(() => rm(root, { recursive: true, force: true }));

it("starts empty, round-trips, and survives a bad file", async () => {
	const s = new OrgStore(root);
	expect(await s.read()).toEqual({ created: false, name: "", members: [] });
	await s.write({
		created: true,
		name: "Acme",
		templateId: "startup",
		members: [{ dotId: "dot_aaaaaaaa", domain: "engineering", skillIds: ["builtin:x"] }],
	});
	const again = await new OrgStore(root).read();
	expect(again.name).toBe("Acme");
	expect(again.members[0]!.skillIds).toEqual(["builtin:x"]);
	await mkdir(join(root, "organisation"), { recursive: true });
	await writeFile(join(root, "organisation", "org.json"), "{nope");
	expect((await new OrgStore(root).read()).created).toBe(false);
});
