import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { OpenDotError } from "../../shared/errors";
import { registerSecretForRedaction } from "../log";
import { Queue } from "../store/json-file";

/** Minimal surface of Electron's safeStorage (injected so tests can mock it). */
export interface SafeStorageLike {
	isEncryptionAvailable(): boolean;
	encryptString(plain: string): Buffer;
	decryptString(enc: Buffer): string;
}

/** safeStorage-encrypted key/value store at ~/.opendot/secrets.bin (spec 06 §2). Never falls back to plaintext. */
export class SecretStore {
	private map: Record<string, string> | undefined;
	private readonly queue = new Queue();

	private constructor(
		private readonly file: string,
		private readonly safe: SafeStorageLike,
	) {}

	static async create(file: string, safe: SafeStorageLike): Promise<SecretStore> {
		const s = new SecretStore(file, safe);
		await s.load().catch(() => undefined);
		return s;
	}

	available(): boolean {
		return this.safe.isEncryptionAvailable();
	}

	async get(key: string): Promise<string | undefined> {
		const m = await this.load();
		return m[key];
	}

	async has(key: string): Promise<boolean> {
		return (await this.get(key)) !== undefined;
	}

	set(key: string, value: string): Promise<void> {
		if (!this.available()) {
			return Promise.reject(new OpenDotError("SECRETS_UNAVAILABLE", "Secure storage is not available on this system."));
		}
		registerSecretForRedaction(value);
		return this.queue.run(async () => {
			const m = await this.load();
			m[key] = value;
			await this.persist(m);
		});
	}

	delete(key: string): Promise<void> {
		return this.queue.run(async () => {
			const m = await this.load();
			if (!(key in m)) return;
			delete m[key];
			await this.persist(m);
		});
	}

	deletePrefix(prefix: string): Promise<void> {
		return this.queue.run(async () => {
			const m = await this.load();
			let changed = false;
			for (const k of Object.keys(m)) {
				if (k.startsWith(prefix)) {
					delete m[k];
					changed = true;
				}
			}
			if (changed) await this.persist(m);
		});
	}

	private async load(): Promise<Record<string, string>> {
		if (this.map) return this.map;
		let buf: Buffer;
		try {
			buf = await readFile(this.file);
		} catch {
			this.map = {};
			return this.map;
		}
		if (!this.available())
			throw new OpenDotError("SECRETS_UNAVAILABLE", "Secure storage is not available on this system.");
		this.map = JSON.parse(this.safe.decryptString(buf)) as Record<string, string>;
		for (const v of Object.values(this.map)) registerSecretForRedaction(v);
		return this.map;
	}

	private async persist(m: Record<string, string>): Promise<void> {
		await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
		const tmp = `${this.file}.tmp`;
		await writeFile(tmp, this.safe.encryptString(JSON.stringify(m)), { mode: 0o600 });
		await rename(tmp, this.file);
	}
}
