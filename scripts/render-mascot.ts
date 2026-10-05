/**
 * T31: render Odi's static fallback images.
 *
 *   npm run dev            # in another shell (the /dev-odi route is dev-only)
 *   node --experimental-strip-types scripts/render-mascot.ts
 *
 * Env: BASE_URL (default http://localhost:3000), PW_CHROMIUM (explicit browser executable).
 * Loads /dev-odi?render=<pose>&size=1024 (transparent, animation frozen at the pose's "nice frame") at 2x DPR,
 * trims with sharp, caps at 1200px and writes public/mascot/odi-<pose>.{png,webp} + odi-head.png (512x512).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = join(process.cwd(), "public", "mascot");
// keep in sync with components/mascot/poses.ts
const POSE_NAMES = ["hero", "thinking", "cheer", "night", "conductor", "shield", "envelope", "peek"] as const;
const SIZE = 1024;
const MAX = 1200;

function findChromium(): string | undefined {
	if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
	const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
	if (!existsSync(root)) return undefined;
	for (const d of readdirSync(root).sort().reverse()) {
		for (const rel of ["chrome-linux/headless_shell", "chrome-linux/chrome"]) {
			const p = join(root, d, rel);
			if ((d.startsWith("chromium_headless_shell") || d.startsWith("chromium-")) && existsSync(p)) return p;
		}
	}
	return undefined;
}

async function launch() {
	const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
	try {
		return await chromium.launch({ args });
	} catch {
		return await chromium.launch({ args, executablePath: findChromium() });
	}
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 2 });

async function shot(name: string): Promise<Buffer> {
	const page = await ctx.newPage();
	await page.goto(`${BASE}/dev-odi?render=${name}&size=${SIZE}`, { waitUntil: "networkidle" });
	await page.waitForFunction(() => (window as unknown as { __odiReady?: boolean }).__odiReady === true, null, {
		timeout: 120_000,
	});
	const buf = await page.screenshot({ omitBackground: true });
	await page.close();
	return buf;
}

for (const pose of POSE_NAMES) {
	const raw = await shot(pose);
	const trimmed = await sharp(raw).trim({ threshold: 2 }).toBuffer();
	const sized = sharp(trimmed).resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true });
	const png = await sized.clone().png({ compressionLevel: 9, palette: false }).toBuffer();
	const webp = await sized.clone().webp({ quality: 86, alphaQuality: 90, effort: 6 }).toBuffer();
	writeFileSync(join(OUT, `odi-${pose}.png`), png);
	writeFileSync(join(OUT, `odi-${pose}.webp`), webp);
	console.log(`odi-${pose}: png ${(png.length / 1024).toFixed(0)} KB, webp ${(webp.length / 1024).toFixed(0)} KB`);
}

const head = await shot("head");
const headPng = await sharp(head)
	.trim({ threshold: 2 })
	.resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
	.png({ compressionLevel: 9 })
	.toBuffer();
writeFileSync(join(OUT, "odi-head.png"), headPng);
console.log(`odi-head: png ${(headPng.length / 1024).toFixed(0)} KB`);
await browser.close();
