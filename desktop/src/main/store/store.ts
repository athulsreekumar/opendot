import { appendFile, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { defaultSettings, defaultUiState } from "../../shared/defaults";
import { migrateDotAppearance } from "../../shared/dot-icons";
import { newId } from "../../shared/ids";
import {
	ConnectionSchema,
	DotLinkSchema,
	DotSchema,
	MemorySchema,
	PolicySchema,
	SettingsSchema,
	UiStateSchema,
	UsageSchema,
	WatcherSchema,
} from "../../shared/schemas";
import type {
	AppSettings,
	AuditEntry,
	AuditKind,
	Connection,
	Dot,
	DotEvent,
	DotId,
	DotLink,
	DotMemory,
	ISODate,
	LinkExchange,
	UiState,
	Watcher,
} from "../../shared/types";
import { log } from "../log";
import type { Paths } from "../paths";
import { JsonFile, Queue } from "./json-file";

/** Append-only JSONL file with optional size rotation. */
export class JsonlFile<T> {
	private readonly queue = new Queue();
	constructor(
		private readonly path: string,
		private readonly rotateBytes = 0,
		private readonly keep = 5,
	) {}

	append(entry: T): Promise<void> {
		return this.queue.run(async () => {
			await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
			if (this.rotateBytes > 0) await this.maybeRotate();
			await appendFile(this.path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
		});
	}

	async readAll(): Promise<T[]> {
		let text: string;
		try {
			text = await readFile(this.path, "utf8");
		} catch {
			return [];
		}
		const out: T[] = [];
		for (const line of text.split("\n")) {
			if (!line.trim()) continue;
			try {
				out.push(JSON.parse(line) as T);
			} catch {
				// skip a torn last line
			}
		}
		return out;
	}

	/** Rewrite the file keeping only entries matching `keep`. */
	prune(keepFn: (e: T) => boolean): Promise<void> {
		return this.queue.run(async () => {
			const all = await this.readAll();
			const kept = all.filter(keepFn);
			if (kept.length === all.length) return;
			const tmp = `${this.path}.tmp`;
			await mkdir(dirname(this.path), { recursive: true });
			const { writeFile } = await import("node:fs/promises");
			await writeFile(tmp, kept.map((e) => `${JSON.stringify(e)}\n`).join(""), { mode: 0o600 });
			await rename(tmp, this.path);
		});
	}

	private async maybeRotate(): Promise<void> {
		try {
			const s = await stat(this.path);
			if (s.size < this.rotateBytes) return;
		} catch {
			return;
		}
		for (let i = this.keep - 1; i >= 1; i--) {
			await rename(this.rotated(i), this.rotated(i + 1)).catch(() => undefined);
		}
		await rm(this.rotated(this.keep + 1), { force: true });
		await rename(this.path, this.rotated(1)).catch(() => undefined);
	}

	private rotated(i: number): string {
		return this.path.replace(/\.jsonl$/, `.${i}.jsonl`);
	}
}

/** Directory of dots/<id>/dot.json files, cached in memory. */
export class DotRepo {
	private cache: Map<DotId, Dot> | undefined;
	private readonly files = new Map<DotId, JsonFile<Dot>>();
	private readonly queue = new Queue();
	constructor(private readonly paths: Paths) {}

	private file(id: DotId): JsonFile<Dot> {
		let f = this.files.get(id);
		if (!f) {
			f = new JsonFile<Dot>({
				path: this.paths.dotFile(id),
				schema: DotSchema,
				version: 1,
				defaults: () => {
					throw new Error(`Dot ${id} not found`);
				},
			});
			this.files.set(id, f);
		}
		return f;
	}

	async list(): Promise<Dot[]> {
		return [...(await this.load()).values()];
	}

	async get(id: DotId): Promise<Dot | undefined> {
		return (await this.load()).get(id);
	}

	async put(dot: Dot): Promise<Dot> {
		const map = await this.load();
		await this.file(dot.id).write(dot);
		map.set(dot.id, dot);
		return dot;
	}

	async update(id: DotId, fn: (d: Dot) => Dot): Promise<Dot> {
		return this.queue.run(async () => {
			const map = await this.load();
			const cur = map.get(id);
			if (!cur) throw new Error(`Dot ${id} not found`);
			const next = fn(structuredClone(cur));
			await this.file(id).write(next);
			map.set(id, next);
			return next;
		});
	}

	/** Move dots/<id> to trash/<id>-<epoch>. */
	async remove(id: DotId): Promise<void> {
		const map = await this.load();
		map.delete(id);
		this.files.delete(id);
		await mkdir(this.paths.trashDir, { recursive: true });
		await rename(this.paths.dotDir(id), join(this.paths.trashDir, `${id}-${Date.now()}`)).catch((e) =>
			log.warn("trash dot failed", e),
		);
	}

	private async load(): Promise<Map<DotId, Dot>> {
		if (this.cache) return this.cache;
		const map = new Map<DotId, Dot>();
		let entries: string[] = [];
		try {
			entries = await readdir(this.paths.dotsDir);
		} catch {
			entries = [];
		}
		for (const name of entries) {
			if (!name.startsWith("dot_")) continue;
			const id = name as DotId;
			try {
				const text = await readFile(this.paths.dotFile(id), "utf8");
				const raw = JSON.parse(text) as { data: unknown };
				map.set(id, DotSchema.parse(migrateDotAppearance(raw.data)));
			} catch (e) {
				log.warn(`Skipping unreadable dot ${id}: ${(e as Error).message}`);
			}
		}
		this.cache = map;
		return map;
	}
}

export interface AuditQuery {
	dotId?: DotId;
	kinds?: AuditKind[];
	before?: ISODate;
	limit?: number;
}

export class Store {
	readonly settings: JsonFile<AppSettings>;
	readonly connections: JsonFile<Connection[]>;
	readonly links: JsonFile<DotLink[]>;
	readonly watchers: JsonFile<Watcher[]>;
	readonly policy: JsonFile<z.infer<typeof PolicySchema>>;
	readonly usage: JsonFile<z.infer<typeof UsageSchema>>;
	readonly userMemory: JsonFile<DotMemory>;
	readonly uiState: JsonFile<UiState>;
	readonly dots: DotRepo;
	readonly exchangesLog: JsonlFile<LinkExchange>;
	readonly auditLog: JsonlFile<AuditEntry>;
	private readonly dotMemories = new Map<DotId, JsonFile<DotMemory>>();
	private readonly eventLogs = new Map<DotId, JsonlFile<DotEvent>>();

	constructor(readonly paths: Paths) {
		this.settings = new JsonFile({
			path: paths.settings,
			schema: SettingsSchema,
			defaults: defaultSettings,
			version: 1,
		});
		this.connections = new JsonFile({
			path: paths.connections,
			schema: z.array(ConnectionSchema),
			defaults: () => [],
			version: 1,
		});
		this.links = new JsonFile({ path: paths.links, schema: z.array(DotLinkSchema), defaults: () => [], version: 1 });
		this.watchers = new JsonFile({
			path: paths.watchers,
			schema: z.array(WatcherSchema),
			defaults: () => [],
			version: 1,
		});
		this.policy = new JsonFile({
			path: paths.policy,
			schema: PolicySchema,
			defaults: () => ({ rules: [] }),
			version: 1,
		});
		this.usage = new JsonFile({
			path: paths.usage,
			schema: UsageSchema,
			defaults: () => ({ hourly: {}, daily: {} }),
			version: 1,
		});
		this.userMemory = new JsonFile({
			path: paths.userMemory,
			schema: MemorySchema as unknown as z.ZodType<DotMemory>,
			defaults: () => ({ items: [] }),
			version: 1,
		});
		this.uiState = new JsonFile({ path: paths.uiState, schema: UiStateSchema, defaults: defaultUiState, version: 1 });
		this.dots = new DotRepo(paths);
		this.exchangesLog = new JsonlFile<LinkExchange>(paths.exchanges);
		this.auditLog = new JsonlFile<AuditEntry>(join(paths.auditDir, "audit.jsonl"), 5 * 1024 * 1024, 5);
	}

	dotMemory(dotId: DotId): JsonFile<DotMemory> {
		let f = this.dotMemories.get(dotId);
		if (!f) {
			f = new JsonFile({
				path: this.paths.dotMemory(dotId),
				schema: MemorySchema as unknown as z.ZodType<DotMemory>,
				defaults: () => ({ items: [] }),
				version: 1,
			});
			this.dotMemories.set(dotId, f);
		}
		return f;
	}

	events(dotId: DotId): JsonlFile<DotEvent> {
		let f = this.eventLogs.get(dotId);
		if (!f) {
			f = new JsonlFile<DotEvent>(this.paths.dotEvents(dotId));
			this.eventLogs.set(dotId, f);
		}
		return f;
	}

	/** Latest record per event id (the log is append-only; status changes append a new copy). */
	async latestEvents(dotId: DotId): Promise<DotEvent[]> {
		const byId = new Map<string, DotEvent>();
		for (const e of await this.events(dotId).readAll()) byId.set(e.id, e);
		return [...byId.values()].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
	}

	async setEventStatus(dotId: DotId, ids: string[], status: DotEvent["status"]): Promise<void> {
		if (!ids.length) return;
		const want = new Set(ids);
		for (const e of await this.latestEvents(dotId)) {
			if (want.has(e.id) && e.status !== status) await this.events(dotId).append({ ...e, status });
		}
	}

	forgetDot(dotId: DotId): void {
		this.dotMemories.delete(dotId);
		this.eventLogs.delete(dotId);
	}

	async audit(entry: Omit<AuditEntry, "id" | "at">): Promise<void> {
		await this.auditLog
			.append({ id: newId("aud"), at: new Date().toISOString(), ...entry })
			.catch((e) => log.warn("audit append failed", e));
	}

	async queryAudit(q: AuditQuery): Promise<AuditEntry[]> {
		const all = await this.auditLog.readAll();
		const limit = q.limit ?? 200;
		const out: AuditEntry[] = [];
		for (let i = all.length - 1; i >= 0 && out.length < limit; i--) {
			const e = all[i]!;
			if (q.dotId && e.dotId !== q.dotId) continue;
			if (q.kinds && !q.kinds.includes(e.kind)) continue;
			if (q.before && e.at >= q.before) continue;
			out.push(e);
		}
		return out;
	}

	/** Latest state of each exchange (append-only log; the last line per id wins). */
	async exchanges(): Promise<LinkExchange[]> {
		const all = await this.exchangesLog.readAll();
		const byId = new Map<string, LinkExchange>();
		for (const e of all) byId.set(e.id, e);
		return [...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	}
}
