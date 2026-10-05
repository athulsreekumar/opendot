/// <reference lib="dom" />
// Builds a seeded OpenDot data dir: 7 Dots, shared "About me" memory, connections, Dot Links and earlier chats.
// Usage: tsx seed/build-data-dir.ts <outDir> [--without Inbox,Travel]
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { launch } from "../lib/app";
import { SCRIPTS_DIR, SEED_DIR } from "../lib/paths";

type Json = Record<string, any>;
const readJson = (p: string): Json => JSON.parse(readFileSync(p, "utf8"));
const DOTS = readJson(join(SEED_DIR, "dots.json"));
const HISTORIES = readJson(join(SEED_DIR, "histories.json")) as Record<string, Array<{ user: string; script: string }>>;

const FIXED_IDS = {
	mac: "con_CapMac000001",
	google: "con_CapGoogle0001",
	microsoft: "con_CapMicrosoft1",
	fetch: "con_CapFetch00001",
	github: "con_CapGithub0001",
	filesystem: "con_CapFiles00001",
	notion: "con_CapNotion0001",
} as const;

const OWNER = "jordan.avery@example.com";
const iso = () => new Date().toISOString();

/** Write connections.json and secrets.bin (E2E format) before the first launch. */
function writeConnectionFiles(dir: string): void {
	const now = iso();
	const base = { enabled: true, exposure: "direct", toolExposure: {}, createdAt: now };
	const mcp = (key: keyof typeof FIXED_IDS, label: string, description: string, icon: string, type: "mcp-stdio" | "mcp-http") => ({
		...base,
		id: FIXED_IDS[key],
		type: "mcp-stdio", // the fake server speaks stdio; the card shows what a real install would
		name: key,
		label,
		description,
		icon,
		catalogId: key,
		stdio: { command: process.execPath, args: [join(SEED_DIR, "fake-mcp.mjs"), key], env: {} },
		features: [],
		...(type === "mcp-http" ? {} : {}),
	});
	const list = [
		{ ...base, id: FIXED_IDS.mac, type: "mac", name: "mac", label: "This Mac", description: "Files, shell, Calendar, Reminders, Contacts, Notes, screen, clipboard and more.", icon: "laptop", features: ["files", "shell", "calendar", "reminders", "contacts", "notes", "screen", "clipboard", "notifications", "open"] },
		{ ...base, id: FIXED_IDS.google, type: "google", name: "google", label: "Google Workspace", description: "Gmail, Google Calendar and Drive.", icon: "mail", features: ["gmail", "calendar", "drive"], configured: true, account: OWNER },
		{ ...base, id: FIXED_IDS.microsoft, type: "microsoft", name: "microsoft", label: "Microsoft 365", description: "Outlook mail and calendar, OneDrive and Teams.", icon: "calendar", features: ["mail", "calendar", "onedrive", "teams"], configured: true, account: "jordan@quillbyte.example.com" },
		mcp("fetch", "Fetch", "Fetch and parse web pages and APIs.", "globe", "mcp-stdio"),
		mcp("github", "GitHub", "Access and manage GitHub repositories and issues.", "github", "mcp-http"),
		mcp("filesystem", "Filesystem", "Read and write files in any directory on your computer.", "folder", "mcp-stdio"),
		mcp("notion", "Notion", "Read and write Notion databases and pages.", "book-open", "mcp-http"),
	];
	writeFileSync(join(dir, "connections.json"), `${JSON.stringify({ version: 1, data: list }, null, 2)}\n`, { mode: 0o600 });
	const tokens = JSON.stringify({ access_token: "capture-token", refresh_token: "capture-refresh", expires_at: Date.now() + 10 * 365 * 86400_000 });
	const secrets = JSON.stringify({
		[`oauth:${FIXED_IDS.google}`]: tokens,
		[`oauth:${FIXED_IDS.microsoft}`]: tokens,
		[`oauthclient:${FIXED_IDS.google}`]: JSON.stringify({ clientId: "capture.apps.example.com" }),
		[`oauthclient:${FIXED_IDS.microsoft}`]: JSON.stringify({ clientId: "00000000-0000-0000-0000-000000000000" }),
	});
	// Matches the E2E safeStorage stand-in in src/main/index.ts.
	writeFileSync(join(dir, "secrets.bin"), Buffer.from(`e2e:${Buffer.from(secrets).toString("base64")}`), { mode: 0o600 });
}

function lastText(script: string): string {
	const steps = readJson(join(SCRIPTS_DIR, `${script}.json`)).steps as any[];
	for (let i = steps.length - 1; i >= 0; i--) {
		const t = steps[i].content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
		if (t) return t;
	}
	return "";
}

async function waitForReply(page: Page, dotId: string, expected: string): Promise<void> {
	const needle = expected.slice(0, 40);
	await page.waitForFunction(
		async ({ dotId, needle }) => {
			const h = await window.opendot.chat.history(dotId as `dot_${string}`);
			return h.messages.some((m) => m.role === "assistant" && !m.streaming && m.text.includes(needle));
		},
		{ dotId, needle },
		{ timeout: 60000, polling: 500 },
	);
}

let storyWindows: Array<{ dot: string; start: number; end: number; story: number }> = [];
let storyIds: Record<string, string> = {};

/** Map a real seeding timestamp (ms) to its place in the story timeline. */
function remap(t: number): number {
	// Windows run back to back, so the latest one that started before t owns it.
	for (let i = storyWindows.length - 1; i >= 0; i--) {
		const w = storyWindows[i]!;
		if (t >= w.start - 100) return t > w.end + 5000 ? t : w.story + (t - w.start);
	}
	return t;
}
const TIME_KEYS = new Set(["timestamp", "startedAt", "endedAt", "createdAt", "updatedAt"]);
function retimeValue(key: string, v: any): any {
	if (Array.isArray(v)) return v.map((x) => retimeValue(key, x));
	if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, retimeValue(k, x)]));
	if (TIME_KEYS.has(key)) {
		if (typeof v === "number" && v > 1.5e12 && v < 2.5e12) return remap(v);
		if (typeof v === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v)) return new Date(remap(Date.parse(v))).toISOString();
	}
	return v;
}
function walk(dir: string, out: string[] = []): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith(".jsonl")) out.push(p);
	}
	return out;
}

/** After the app has closed: move every timestamp onto the story timeline and set unread counts / last activity. */
function retimeDataDir(dir: string): void {
	for (const f of [...walk(join(dir, "dots")), join(dir, "link-exchanges.jsonl")]) {
		let text: string;
		try {
			text = readFileSync(f, "utf8");
		} catch {
			continue;
		}
		const lines = text
			.split("\n")
			.filter(Boolean)
			.map((l) => {
				const e = JSON.parse(l);
				// The scripted reply object is created before the user's message is sent; use the write time instead.
				if (e.message && typeof e.message.timestamp === "number" && e.timestamp) e.message.timestamp = Date.parse(e.timestamp);
				return JSON.stringify(retimeValue("", e));
			});
		writeFileSync(f, `${lines.join("\n")}\n`);
	}
	const lastByDot = new Map<string, number>();
	for (const w of storyWindows) lastByDot.set(w.dot, Math.max(lastByDot.get(w.dot) ?? 0, w.story + (w.end - w.start)));
	for (const [name, id] of Object.entries(storyIds)) {
		const f = join(dir, "dots", id, "dot.json");
		const j = readJson(f);
		const last = lastByDot.get(id);
		const d = j.data;
		d.createdAt = new Date(Date.now() - 4 * 86400_000).toISOString();
		if (last) d.lastActivityAt = new Date(last).toISOString();
		d.updatedAt = d.lastActivityAt;
		d.unreadCount = (DOTS.unread as Record<string, number>)[name] ?? 0;
		writeFileSync(f, `${JSON.stringify(j, null, 2)}\n`);
	}
}

export async function buildDataDir(outDir: string, opts: { without?: string[] } = {}): Promise<void> {
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });
	writeConnectionFiles(outDir);
	const without = new Set(opts.without ?? []);
	const { app, page } = await launch({ dataDir: outDir, tps: 3000 });
	try {
		await page.evaluate(async () => {
			await window.opendot.settings.update({
				defaultModel: { providerId: "opendot-fake", modelId: "fake-1" },
				onboardingDone: true,
				theme: "light",
				notifications: { enabled: false, sound: false, showPreview: false },
				background: { runInBackground: false, launchAtLogin: false, hideDockWhenClosed: false, keepAwake: false, maxCostUsdPerDay: 10, paused: false },
			});
		});
		// Model providers (keys are fake; nothing is ever sent anywhere).
		await page.evaluate(async () => {
			const api = window.opendot;
			for (const [id, key] of [["anthropic", "sk-ant-capture-1234"], ["openai", "sk-capture-5678"], ["google", "AIza-capture-9012"]] as const) {
				await api.models.addProvider({ kind: "cloud", builtinProviderId: id, apiKey: key });
				await api.models.setSecret(id, key);
				// Show the provider's real model list instead of "0 models".
				const mine = (await api.models.listModels()).filter((m) => m.providerId === id).slice(0, 8);
				await api.models.updateProvider(id, { models: mine.map((m) => ({ id: m.modelId, label: m.label })) });
			}
			await api.models.addProvider({ kind: "self-hosted", preset: "ollama", baseUrl: "http://localhost:11434/v1" });
			await api.models.addProvider({
				kind: "custom-url",
				label: "Acme AI gateway",
				baseUrl: "https://llm.acme.example.com/v1",
				api: "openai-completions",
				models: ["acme-large", "acme-fast"],
			});
		});
		// About me (shared by every Dot).
		for (const m of DOTS.memory) {
			await page.evaluate((m) => window.opendot.memory.upsert("user", m), m);
		}
		// SuperDot: the built-in Dot, renamed.
		const superId = await page.evaluate(async (s) => {
			const d = await window.opendot.superbot.get();
			const rename = (t: string) => t.replace(/\bSuper\b/g, "SuperDot").replace(/\s*\u2014\s*/g, ". ");
			await window.opendot.dots.update(d.id, {
				name: s.name,
				tagline: s.tagline,
				appearance: s.appearance,
				pinned: true,
				persona: {
					...d.persona,
					role: rename(d.persona.role),
					greeting: "Hi! I'm SuperDot. Ask me anything and I'll check with your Dots and bring the answer back.",
				},
			});
			return d.id;
		}, DOTS.superbot);

		const ids: Record<string, string> = { SuperDot: superId };
		for (const d of DOTS.dots as Json[]) {
			if (without.has(d.name)) continue;
			const wanted = (d.connectors as string[]).map((c) => (c in FIXED_IDS ? FIXED_IDS[c as keyof typeof FIXED_IDS] : c));
			ids[d.name] = await page.evaluate(async ({ d, wanted }) => {
				const choices = await window.opendot.dots.connectorChoices();
				const connectors = wanted.map((c) => choices.find((x) => x.id === c)).filter((x) => !!x);
				const draft = {
					name: d.name,
					tagline: d.tagline,
					appearance: d.appearance,
					roles: d.roles,
					persona: { customInstructions: "", ...d.persona },
					thinkingLevel: "low" as const,
					piiMode: "auto" as const,
					suggestedConnections: wanted,
					...(d.alwaysOn ? { alwaysOn: d.alwaysOn } : {}),
				};
				const dot = await window.opendot.dots.create({
					draft,
					creationPrompt: d.creationPrompt ?? `${d.tagline}.`,
					connectors: connectors as never,
					watchers: d.watchers ?? [],
				});
				if (d.toolRules) {
					const fresh = await window.opendot.dots.get(dot.id);
					await window.opendot.dots.update(dot.id, {
						grants: fresh.grants.map((g) => ({ ...g, toolRules: { ...g.toolRules, ...d.toolRules } })),
					});
				}
				return dot.id;
			}, { d, wanted });
		}

		// Dot Links: who may talk to whom.
		await page.evaluate(async (ids) => {
			const dot = (n: string) => ({ kind: "dot" as const, dotId: ids[n] as `dot_${string}` });
			const mk = (from: any, to: any, extra: Record<string, unknown>) =>
				window.opendot.links.upsert({ from, to, effect: "allow", enabled: true, approval: "auto", maxPerHour: 20, sharePii: false, purpose: "", ...extra } as never);
			const has = (n: string) => !!ids[n];
			if (has("Inbox") && has("Calendar")) await mk(dot("Inbox"), dot("Calendar"), { purpose: "Check deadlines against the calendar", maxPerHour: 20 });
			if (has("Travel") && has("Calendar"))
				await mk(dot("Travel"), dot("Calendar"), {
					approval: "ask",
					maxPerHour: 5,
					purpose: "Check availability before planning a trip",
					schedule: { timeZone: "Europe/Lisbon", days: [1, 2, 3, 4, 5], start: "08:00", end: "19:00" },
				});
			if (has("Calendar") && has("Travel")) await mk(dot("Calendar"), dot("Travel"), { maxPerHour: 10, purpose: "Block travel time on the calendar" });
			if (has("Money") && has("Inbox")) await mk(dot("Money"), dot("Inbox"), { approval: "ask", maxPerHour: 10, purpose: "Find receipts and invoices" });
			if (has("Research")) await mk(dot("Research"), { kind: "any" }, { effect: "deny", purpose: "Research only reads the web" });
			if (has("Code Buddy")) await mk(dot("Code Buddy"), { kind: "any" }, { effect: "deny", purpose: "Keeps code review private" });
		}, ids);

		// Earlier conversations (real turns through the scripted model).
		const windows: Array<{ dot: string; start: number; end: number; story: number }> = [];
		for (const name of ["Inbox", "Calendar", "Research", "Money", "Travel", "Code Buddy", "SuperDot"]) {
			const id = ids[name];
			if (!id) continue;
			for (const turn of (HISTORIES[name] ?? []) as Array<{ user: string; script: string; agoMin: number }>) {
				const start = Date.now();
				await page.evaluate(async ({ id, turn }) => {
					await window.opendotTest!.setFakeScript(turn.script);
					await window.opendot.chat.send(id as `dot_${string}`, turn.user);
				}, { id, turn });
				await waitForReply(page, id, lastText(turn.script));
				await page.waitForTimeout(400);
				windows.push({ dot: ids[name]!, start, end: Date.now(), story: start - turn.agoMin * 60_000 });
			}
		}
		storyWindows = windows;
		storyIds = ids;
		await page.evaluate(async () => {
			await window.opendotTest!.setFakeScript("event-quiet");
		});
		await page.waitForTimeout(500);
	} finally {
		await app.close();
	}
	retimeDataDir(outDir);
	// Mark every provider as tested so the status dots are green.
	const sf = join(outDir, "settings.json");
	const sj = readJson(sf);
	for (const p of sj.data.providers) if (p.id !== "opendot-fake") p.lastTest = { ok: true, message: "Connected", at: new Date().toISOString() };
	writeFileSync(sf, `${JSON.stringify(sj, null, 2)}\n`);
	writeFileSync(join(outDir, "_ids.json"), JSON.stringify(storyIds, null, 2));
}

if (process.argv[1]?.endsWith("build-data-dir.ts")) {
	const out = process.argv[2];
	if (!out) throw new Error("usage: build-data-dir.ts <outDir> [--without A,B]");
	const wi = process.argv.indexOf("--without");
	await buildDataDir(out, { without: wi > 0 ? process.argv[wi + 1]!.split(",") : [] });
	console.log("seeded", out, readdirSync(out).join(" "));
}
