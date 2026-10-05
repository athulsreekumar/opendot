/// <reference lib="dom" />
// Scene recorder: launches the app on a seeded data dir, records the X display with ffmpeg while a driver
// script plays a human-paced interaction, and writes <scene>.mp4 + <scene>.cursor.json (+ .marks.json).
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "playwright-core";
import { cloneDataDir, coverScreen, type Launched, launch } from "./app";
import { OUT_DIR } from "./paths";
import { ensureSeed, type SeedName } from "./seeds";
import { followChat, setTheme, type Theme, warmConnections } from "./ui";

export const SCREEN = { w: 2880, h: 1800 } as const;
export const FPS = 60;

export interface CursorEvent {
	t: number;
	x: number;
	y: number;
	type: "move" | "down" | "up";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** A synthetic cursor: moves the page's mouse along eased paths and logs every position (logical px, ms from t0). */
export class Cursor {
	x = 1180;
	y = 640;
	readonly log: CursorEvent[] = [];
	constructor(
		private readonly page: Page,
		private readonly now: () => number,
	) {}

	private push(type: CursorEvent["type"]): void {
		this.log.push({ t: Math.round(this.now()), x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10, type });
	}

	async init(): Promise<void> {
		await this.page.mouse.move(this.x, this.y);
		this.push("move");
	}

	/** Eased move along a gentle arc. */
	async moveTo(x: number, y: number, dur?: number): Promise<void> {
		const dx = x - this.x;
		const dy = y - this.y;
		const dist = Math.hypot(dx, dy);
		const ms = dur ?? Math.min(800, Math.max(350, 220 + dist * 0.5)) * rand(0.9, 1.12);
		const sx = this.x;
		const sy = this.y;
		// Perpendicular offset for a slight curve.
		const nx = -dy / (dist || 1);
		const ny = dx / (dist || 1);
		const bend = Math.min(60, dist * 0.12) * (Math.random() < 0.5 ? -1 : 1);
		const t0 = performance.now();
		for (;;) {
			const u = Math.min(1, (performance.now() - t0) / ms);
			const e = ease(u);
			const arc = Math.sin(Math.PI * e) * bend;
			this.x = sx + dx * e + nx * arc;
			this.y = sy + dy * e + ny * arc;
			await this.page.mouse.move(this.x, this.y);
			this.push("move");
			if (u >= 1) break;
			await sleep(Math.max(0, 1000 / FPS - 4));
		}
	}

	private async point(target: Locator | { x: number; y: number }): Promise<{ x: number; y: number }> {
		if ("x" in target) return target;
		await target.scrollIntoViewIfNeeded();
		const box = await target.boundingBox();
		if (!box) throw new Error("target has no box");
		return { x: box.x + box.width * rand(0.4, 0.6), y: box.y + box.height * rand(0.4, 0.6) };
	}

	async hover(target: Locator | { x: number; y: number }, dur?: number): Promise<void> {
		const p = await this.point(target);
		await this.moveTo(p.x, p.y, dur);
	}

	async click(target: Locator | { x: number; y: number }, dur?: number): Promise<void> {
		await this.hover(target, dur);
		await sleep(rand(90, 170));
		await this.page.mouse.down();
		this.push("down");
		await sleep(rand(60, 100));
		await this.page.mouse.up();
		this.push("up");
	}
}

export interface SceneCtx extends Launched {
	cursor: Cursor;
	/** Type with human cadence (35-70 ms per character, longer after punctuation). */
	type(text: string): Promise<void>;
	pause(ms: number): Promise<void>;
	/** Pause 600-900 ms on a key state. */
	beat(): Promise<void>;
	/** Record a named moment (ms from recording start) for the editor. */
	mark(label: string): void;
	/** ms since recording started. */
	now(): number;
}

export interface SceneSpec {
	name: string;
	seed?: SeedName;
	theme?: Theme;
	/** Mutate the cloned data dir before launch (e.g. hide Dots so they can appear on camera). */
	prepare?: (dataDir: string) => void | Promise<void>;
	/** Runs before recording starts (navigate, open a chat). */
	setup?: (ctx: SceneCtx) => Promise<void>;
	/** The recorded interaction. */
	run: (ctx: SceneCtx) => Promise<void>;
	headMs?: number;
	tailMs?: number;
}

/**
 * Stage 1 (live): grab the display with a very fast, near-lossless x264 profile so the encoder never falls behind the
 * app. Stage 2 (after the scene): re-encode to the delivery settings (libx264 crf 12, preset veryfast, yuv420p).
 */
function startFfmpeg(file: string): { proc: ChildProcess; started: Promise<void>; done: Promise<void> } {
	const display = process.env.DISPLAY ?? ":99";
	const proc = spawn(
		"ffmpeg",
		[
			"-y",
			"-hide_banner",
			"-f", "x11grab",
			"-framerate", String(FPS),
			"-video_size", `${SCREEN.w}x${SCREEN.h}`,
			"-draw_mouse", "0",
			"-i", `${display}.0`,
			"-c:v", "libx264",
			"-preset", "ultrafast",
			"-crf", "6",
			"-pix_fmt", "yuv420p",
			"-r", String(FPS),
			"-vsync", "cfr",
			"-g", "60",
			file,
		],
		{ stdio: ["pipe", "ignore", "pipe"] },
	);
	let resolveStarted!: () => void;
	const started = new Promise<void>((r) => {
		resolveStarted = r;
	});
	let buf = "";
	let slow = 0;
	proc.stderr!.on("data", (d: Buffer) => {
		const text = d.toString();
		buf += text;
		if (/frame=\s*\d+/.test(buf)) resolveStarted();
		if (buf.length > 4000) buf = buf.slice(-2000);
		const sp = /speed=\s*([\d.]+)x/.exec(text);
		if (sp && Number(sp[1]) < 0.97 && ++slow % 10 === 1) console.log(`  ffmpeg capture speed ${sp[1]}x (falling behind)`);
	});
	const done = new Promise<void>((resolve, reject) => {
		proc.on("exit", (code) => (code === 0 || code === 255 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
	});
	return { proc, started, done };
}

function encodeFinal(src: string, dst: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const p = spawn(
			"ffmpeg",
			["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-preset", process.env.OPENDOT_REC_PRESET ?? "veryfast",
				"-crf", process.env.OPENDOT_REC_CRF ?? "12", "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", "120", "-movflags", "+faststart", dst],
			{ stdio: "inherit" },
		);
		p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`final encode exited with ${code}`))));
	});
}

export async function recordScene(spec: SceneSpec): Promise<void> {
	mkdirSync(OUT_DIR, { recursive: true });
	const theme = spec.theme ?? ((process.env.OPENDOT_SCENE_THEME as Theme | undefined) ?? "light");
	const seedDir = await ensureSeed(spec.seed ?? "full", { reuse: true });
	const dataDir = cloneDataDir(seedDir);
	await spec.prepare?.(dataDir);
	const launched = await launch({ dataDir, tps: Number(process.env.OPENDOT_FAKE_TPS ?? 45) });
	const { page, app } = launched;
	await coverScreen(app);
	let t0 = 0;
	const now = () => (t0 ? performance.now() - t0 : 0);
	const cursor = new Cursor(page, now);
	const marks: Array<{ label: string; t: number }> = [];
	let ff: ReturnType<typeof startFfmpeg> | undefined;
	const ctx: SceneCtx = {
		...launched,
		cursor,
		pause: (ms) => sleep(ms),
		beat: () => sleep(rand(600, 900)),
		mark: (label) => marks.push({ label, t: Math.round(now()) }),
		now,
		async type(text: string) {
			for (const ch of text) {
				await page.keyboard.type(ch);
				await sleep(rand(35, 70) + (/[.,?!]/.test(ch) ? rand(60, 140) : 0));
			}
		},
	};
	try {
		// Make the page behave as the focused window: caret blinks, :focus rings show.
		const cdp = await page.context().newCDPSession(page);
		await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
		await setTheme(page, theme);
		await warmConnections(page);
		await followChat(page);
		await spec.setup?.(ctx);
		await page.evaluate(() => document.fonts.ready);
		await sleep(600);

		const raw = join(OUT_DIR, `${spec.name}.rec.mkv`);
		const file = join(OUT_DIR, `${spec.name}.mp4`);
		ff = startFfmpeg(raw);
		await ff.started;
		t0 = performance.now();
		await cursor.init();
		await sleep(spec.headMs ?? 1000);
		await spec.run(ctx);
		await sleep(spec.tailMs ?? 1000);
		const total = Math.round(now());
		ff.proc.stdin!.write("q");
		await ff.done;
		await encodeFinal(raw, file);
		rmSync(raw, { force: true });
		writeFileSync(join(OUT_DIR, `${spec.name}.cursor.json`), `${JSON.stringify(cursor.log)}\n`);
		writeFileSync(join(OUT_DIR, `${spec.name}.marks.json`), `${JSON.stringify({ durationMs: total, marks }, null, 2)}\n`);
		console.log(`${spec.name}: ${(total / 1000).toFixed(1)} s, ${cursor.log.length} cursor samples`);
	} finally {
		// Never leave a recorder running if a driver fails.
		if (ff && ff.proc.exitCode === null) ff.proc.kill("SIGKILL");
		await app.close().catch(() => undefined);
	}
}
