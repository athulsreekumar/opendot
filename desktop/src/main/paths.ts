// Resolves every on-disk location. Everything lives under ~/.opendot (spec 02 §2).
// Must not import pi: index.ts sets PI_* env vars from these paths before pi loads.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Paths {
	root: string;
	piDir: string;
	logsDir: string;
	auditDir: string;
	trashDir: string;
	settings: string;
	connections: string;
	links: string;
	watchers: string;
	policy: string;
	usage: string;
	userMemory: string;
	uiState: string;
	exchanges: string;
	secrets: string;
	dotsDir: string;
	dotDir(dotId: string): string;
	dotFile(dotId: string): string;
	dotMemory(dotId: string): string;
	dotSessions(dotId: string): string;
	dotArchive(dotId: string): string;
	dotLinkSessions(dotId: string, peerId: string): string;
	dotEvents(dotId: string): string;
	dotDedupe(dotId: string, watcherId: string): string;
	dotVault(dotId: string): string;
	dotWorkspace(dotId: string): string;
}

export function resolveRoot(): string {
	return process.env.OPENDOT_DATA_DIR || join(homedir(), ".opendot");
}

export function createPaths(root = resolveRoot()): Paths {
	const dotsDir = join(root, "dots");
	const dotDir = (id: string) => join(dotsDir, id);
	return {
		root,
		piDir: join(root, "pi"),
		logsDir: join(root, "logs"),
		auditDir: join(root, "audit"),
		trashDir: join(root, "trash"),
		settings: join(root, "settings.json"),
		connections: join(root, "connections.json"),
		links: join(root, "links.json"),
		watchers: join(root, "watchers.json"),
		policy: join(root, "policy.json"),
		usage: join(root, "usage.json"),
		userMemory: join(root, "memory.json"),
		uiState: join(root, "ui-state.json"),
		exchanges: join(root, "link-exchanges.jsonl"),
		secrets: join(root, "secrets.bin"),
		dotsDir,
		dotDir,
		dotFile: (id) => join(dotDir(id), "dot.json"),
		dotMemory: (id) => join(dotDir(id), "memory.json"),
		dotSessions: (id) => join(dotDir(id), "sessions"),
		dotArchive: (id) => join(dotDir(id), "sessions", "archive"),
		dotLinkSessions: (id, peer) => join(dotDir(id), "links", peer),
		dotEvents: (id) => join(dotDir(id), "events.jsonl"),
		dotDedupe: (id, w) => join(dotDir(id), "dedupe", `${w}.json`),
		dotVault: (id) => join(dotDir(id), "pii.vault"),
		dotWorkspace: (id) => join(dotDir(id), "workspace"),
	};
}

export function ensureBaseDirs(p: Paths): void {
	for (const d of [p.root, p.piDir, p.logsDir, p.auditDir, p.dotsDir]) mkdirSync(d, { recursive: true, mode: 0o700 });
}
