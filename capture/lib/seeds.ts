import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildDataDir } from "../seed/build-data-dir";
import { OUT_DIR } from "./paths";

export type SeedName = "full" | "noinbox";

/** "full": 7 Dots. "noinbox": 6 Dots, so the New Dot flow can create the 7th (Inbox) live. */
export async function ensureSeed(name: SeedName, opts: { reuse?: boolean } = {}): Promise<string> {
	const dir = join(OUT_DIR, "seeds", name);
	if (opts.reuse && existsSync(join(dir, "settings.json"))) return dir;
	await buildDataDir(dir, { without: name === "noinbox" ? ["Inbox"] : [] });
	return dir;
}
