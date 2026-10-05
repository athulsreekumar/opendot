import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PiiType } from "../../shared/types";

interface VaultEntry {
	type: PiiType;
	value: string;
	norm: string;
}

interface VaultData {
	byToken: Record<string, VaultEntry>;
	counters: Partial<Record<PiiType, number>>;
}

const DEBOUNCE_MS = 300;
const TOKEN_RE = /⟦[A-Z_]+_\d+⟧/g;

export function normalizePiiValue(type: PiiType, value: string): string {
	switch (type) {
		case "EMAIL":
			return value.trim().toLowerCase();
		case "PHONE": {
			const t = value.trim();
			return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "");
		}
		case "CARD":
		case "IBAN":
			return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
		default:
			return value;
	}
}

export class PiiVault {
	private byToken = new Map<string, VaultEntry>();
	private byKey = new Map<string, string>();
	private counters: Partial<Record<PiiType, number>> = {};
	private timer: NodeJS.Timeout | undefined;
	private waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
	private chain: Promise<void> = Promise.resolve();
	private destroyed = false;

	private constructor(
		private readonly file: string | undefined,
		private readonly getKey: (() => Promise<Buffer>) | undefined,
	) {}

	static async open(file: string, getKey: () => Promise<Buffer>): Promise<PiiVault> {
		const vault = new PiiVault(file, getKey);
		let buf: Buffer | undefined;
		try {
			buf = await readFile(file);
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
		}
		if (buf && buf.length >= 28) {
			const key = await getKey();
			const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
			decipher.setAuthTag(buf.subarray(12, 28));
			const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
			const data = JSON.parse(json) as VaultData;
			vault.counters = data.counters ?? {};
			for (const [token, entry] of Object.entries(data.byToken ?? {})) vault.index(token, entry);
		}
		return vault;
	}

	/** A vault that never touches disk (used for previews). */
	static memory(): PiiVault {
		return new PiiVault(undefined, undefined);
	}

	private index(token: string, entry: VaultEntry): void {
		this.byToken.set(token, entry);
		this.byKey.set(`${entry.type}:${entry.norm}`, token);
	}

	tokenFor(span: { type: PiiType; value: string }): string {
		const norm = normalizePiiValue(span.type, span.value);
		const key = `${span.type}:${norm}`;
		const existing = this.byKey.get(key);
		if (existing) return existing;
		const n = (this.counters[span.type] ?? 0) + 1;
		this.counters[span.type] = n;
		const token = `⟦${span.type}_${n}⟧`;
		this.index(token, { type: span.type, value: span.value, norm });
		return token;
	}

	valueOf(token: string): string | undefined {
		return this.byToken.get(token)?.value;
	}

	entries(): Array<{ token: string; type: PiiType; value: string }> {
		return [...this.byToken].map(([token, e]) => ({ token, type: e.type, value: e.value }));
	}

	restore(text: string): string {
		if (!text.includes("⟦")) return text;
		return text.replace(TOKEN_RE, (tok) => this.byToken.get(tok)?.value ?? tok);
	}

	/** Debounced save (300 ms). Resolves once the write happened. */
	save(): Promise<void> {
		if (!this.file || this.destroyed) return Promise.resolve();
		return new Promise<void>((resolve, reject) => {
			this.waiters.push({ resolve, reject });
			if (this.timer) clearTimeout(this.timer);
			this.timer = setTimeout(() => {
				this.timer = undefined;
				void this.writeNow();
			}, DEBOUNCE_MS);
		});
	}

	/** Save immediately, cancelling any pending debounce. */
	async flush(): Promise<void> {
		if (!this.file || this.destroyed) return;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
		await this.writeNow();
	}

	private writeNow(): Promise<void> {
		const waiters = this.waiters;
		this.waiters = [];
		const run = this.chain.then(async () => {
			if (!this.file || !this.getKey || this.destroyed) return;
			const data: VaultData = { byToken: Object.fromEntries(this.byToken), counters: this.counters };
			const key = await this.getKey();
			const iv = randomBytes(12);
			const cipher = createCipheriv("aes-256-gcm", key, iv);
			const ct = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
			const out = Buffer.concat([iv, cipher.getAuthTag(), ct]);
			await mkdir(dirname(this.file), { recursive: true });
			const tmp = `${this.file}.tmp`;
			await writeFile(tmp, out, { mode: 0o600 });
			await rename(tmp, this.file);
		});
		this.chain = run.catch(() => undefined);
		return run.then(
			() => {
				for (const w of waiters) w.resolve();
			},
			(e) => {
				for (const w of waiters) w.reject(e);
				throw e;
			},
		);
	}

	async destroy(): Promise<void> {
		this.destroyed = true;
		if (this.timer) clearTimeout(this.timer);
		this.timer = undefined;
		const waiters = this.waiters;
		this.waiters = [];
		for (const w of waiters) w.resolve();
		await this.chain;
		this.byToken.clear();
		this.byKey.clear();
		this.counters = {};
		if (this.file) await rm(this.file, { force: true });
	}
}
