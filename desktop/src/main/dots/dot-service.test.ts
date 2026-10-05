import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ConnectionService } from "../connections/connection-service";
import { createPaths, ensureBaseDirs } from "../paths";
import { Store } from "../store/store";
import { DotService } from "./dot-service";
import { SUPER_TEMPLATE } from "./templates";

const OLD_GREETING = "Hi! I'm Super. Ask me anything — I'll check with your Dots and bring the answer back.";
const oldRole = SUPER_TEMPLATE.draft.persona.role.replace("You are SuperDot,", "You are Super,");

async function setup() {
	const root = mkdtempSync(join(tmpdir(), "od-dots-"));
	const paths = createPaths(root);
	ensureBaseDirs(paths);
	const store = new Store(paths);
	const svc = new DotService(store, paths, {} as ConnectionService);
	return { svc, store };
}

describe("ensureSuperBot", () => {
	it("creates the lead assistant as SuperDot", async () => {
		const { svc } = await setup();
		const sup = await svc.ensureSuperBot();
		expect(sup.name).toBe("SuperDot");
		expect(sup.persona.role).toContain("You are SuperDot,");
		expect(sup.persona.greeting).not.toContain("—");
	});

	it("renames a legacy Super and refreshes untouched persona defaults", async () => {
		const { svc, store } = await setup();
		const sup = await svc.ensureSuperBot();
		await store.dots.update(sup.id, (d) => ({
			...d,
			name: "Super",
			persona: { ...d.persona, role: oldRole, greeting: OLD_GREETING },
		}));
		const migrated = await svc.ensureSuperBot();
		expect(migrated.name).toBe("SuperDot");
		expect(migrated.persona.role).toBe(SUPER_TEMPLATE.draft.persona.role);
		expect(migrated.persona.greeting).toBe(SUPER_TEMPLATE.draft.persona.greeting);
		expect((await store.dots.get(sup.id))?.name).toBe("SuperDot");
	});

	it("keeps customised persona text when renaming", async () => {
		const { svc, store } = await setup();
		const sup = await svc.ensureSuperBot();
		await store.dots.update(sup.id, (d) => ({
			...d,
			name: "Super",
			persona: { ...d.persona, role: "You are my boss.", greeting: "Yo." },
		}));
		const migrated = await svc.ensureSuperBot();
		expect(migrated.name).toBe("SuperDot");
		expect(migrated.persona.role).toBe("You are my boss.");
		expect(migrated.persona.greeting).toBe("Yo.");
	});

	it("leaves a user-chosen name alone", async () => {
		const { svc, store } = await setup();
		const sup = await svc.ensureSuperBot();
		await store.dots.update(sup.id, (d) => ({ ...d, name: "Jarvis" }));
		expect((await svc.ensureSuperBot()).name).toBe("Jarvis");
	});
});
