import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The capture/ folder of the website repo. */
export const CAPTURE_DIR = resolve(here, "..");
/** The website repo root. */
export const SITE_DIR = resolve(CAPTURE_DIR, "..");
/** The OpenDot Electron app (override with OPENDOT_APP_DIR). */
export const APP_DIR = resolve(process.env.OPENDOT_APP_DIR ?? "/home/user/claude-code-remote/opendot");

export const SEED_DIR = join(CAPTURE_DIR, "seed");
export const SCRIPTS_DIR = join(SEED_DIR, "scripts");
export const OUT_DIR = join(CAPTURE_DIR, "out");
export const SHOTS_PUBLIC = join(SITE_DIR, "public/shots");
export const FILM_RAW = join(SITE_DIR, "public/film/raw");
