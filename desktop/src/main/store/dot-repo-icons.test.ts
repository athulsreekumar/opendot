import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ConnectionService } from "../connections/connection-service";
import { DotService } from "../dots/dot-service";
import { createPaths, ensureBaseDirs } from "../paths";
import { Store } from "./store";

async function setup() {
	const paths = createPaths(mkdtempSync(join(tmpdir(), "od-icons-")));
	ensureBaseDirs(paths);
	const store = new Store(paths);
	const svc = new DotService(store, paths, {} as ConnectionService);
	const sup = await svc.ensureSuperBot();
	return { paths, svc, sup };
}

/** Rewrite a dot.json the way an older version wrote it: `emoji` instead of `icon`. */
function downgrade(file: string, emoji: string, patch: Record<string, unknown> = {}) {
	const raw = JSON.parse(readFileSync(file, "utf8"));
	raw.data = { ...raw.data, ...patch, appearance: { emoji, color: raw.data.appearance.color } };
	writeFileSync(file, JSON.stringify(raw, null, 2));
}

describe("dot.json icon migration", () => {
	it("adds an icon from a known emoji on load and persists it on the next save", async () => {
		const { paths, sup } = await setup();
		const file = paths.dotFile(sup.id);
		downgrade(file, "✈️", { kind: "standard", name: "Trips", tagline: "" });
		const store = new Store(paths);
		const loaded = await store.dots.get(sup.id);
		expect(loaded?.appearance.icon).toBe("plane");
		expect("emoji" in (loaded?.appearance ?? {})).toBe(false);
		// Not rewritten until something saves.
		expect(JSON.parse(readFileSync(file, "utf8")).data.appearance.emoji).toBe("✈️");
		await store.dots.update(sup.id, (d) => ({ ...d, pinned: true }));
		const onDisk = JSON.parse(readFileSync(file, "utf8")).data.appearance;
		expect(onDisk).toEqual({ icon: "plane", color: loaded?.appearance.color });
	});

	it("uses keywords from the name and tagline when the emoji is unknown", async () => {
		const { paths, sup } = await setup();
		downgrade(paths.dotFile(sup.id), "🫠", { kind: "standard", name: "Budget", tagline: "Tracks my spending" });
		const loaded = await new Store(paths).dots.get(sup.id);
		expect(loaded?.appearance.icon).toBe("wallet");
	});

	it("falls back to a neutral icon, and sparkles for a SuperDot", async () => {
		const { paths, sup } = await setup();
		downgrade(paths.dotFile(sup.id), "🫠", { kind: "standard", name: "Zorp", tagline: "Blarg" });
		expect((await new Store(paths).dots.get(sup.id))?.appearance.icon).toBe("message");
		downgrade(paths.dotFile(sup.id), "🫠", { kind: "super", name: "Zorp", tagline: "Blarg" });
		expect((await new Store(paths).dots.get(sup.id))?.appearance.icon).toBe("sparkles");
	});
});
