import { mkdir, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { z } from "zod";
import { log } from "../log";

/** Serialises async operations. */
export class Queue {
	private tail: Promise<unknown> = Promise.resolve();
	run<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.tail.then(fn, fn);
		this.tail = next.catch(() => undefined);
		return next;
	}
}

export interface JsonFileOptions<T> {
	path: string;
	schema: z.ZodType<T>;
	defaults: () => T;
	version: number;
	migrate?: (raw: unknown, fromVersion: number) => T;
}

/** Atomic, validated, cached JSON file `{ version, data }` (spec 02 §2). */
export class JsonFile<T> {
	private cache: T | undefined;
	private readonly queue = new Queue();
	constructor(private readonly opts: JsonFileOptions<T>) {}

	get path(): string {
		return this.opts.path;
	}

	async read(): Promise<T> {
		if (this.cache !== undefined) return this.cache;
		return this.queue.run(async () => {
			if (this.cache !== undefined) return this.cache;
			this.cache = await this.load();
			return this.cache;
		});
	}

	write(next: T): Promise<void> {
		return this.queue.run(async () => {
			await this.persist(next);
		});
	}

	update(fn: (cur: T) => T | Promise<T>): Promise<T> {
		return this.queue.run(async () => {
			const cur = this.cache !== undefined ? this.cache : await this.load();
			const next = await fn(structuredClone(cur));
			await this.persist(next);
			return next;
		});
	}

	/** Drop the cache (e.g. after the file was replaced on disk). */
	invalidate(): void {
		this.cache = undefined;
	}

	private async persist(next: T): Promise<void> {
		const parsed = this.opts.schema.parse(next);
		await mkdir(dirname(this.opts.path), { recursive: true, mode: 0o700 });
		await writeFileAtomic(
			this.opts.path,
			`${JSON.stringify({ version: this.opts.version, data: parsed }, null, 2)}\n`,
			{
				mode: 0o600,
			},
		);
		this.cache = parsed;
	}

	private async load(): Promise<T> {
		let text: string;
		try {
			text = await readFile(this.opts.path, "utf8");
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === "ENOENT") return this.opts.defaults();
			throw e;
		}
		try {
			const raw = JSON.parse(text) as { version?: number; data?: unknown };
			let data: unknown = raw.data;
			if (raw.version !== this.opts.version && this.opts.migrate) data = this.opts.migrate(raw.data, raw.version ?? 0);
			return this.opts.schema.parse(data);
		} catch (e) {
			const target = `${this.opts.path}.corrupt-${Date.now()}`;
			log.warn(`Corrupt JSON at ${this.opts.path}; moved to ${target}: ${(e as Error).message}`);
			await rename(this.opts.path, target).catch(() => undefined);
			return this.opts.defaults();
		}
	}
}
