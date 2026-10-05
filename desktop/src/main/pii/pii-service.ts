import type { DotId, PiiMode, PiiSettings, PiiType } from "../../shared/types";
import { detectPii, type PiiSpan } from "./detectors";
import { PiiVault } from "./vault";

export interface PiiServiceDeps {
	getSettings(): Promise<PiiSettings>;
	vaultFile(dotId: DotId): string;
	getVaultKey(dotId: DotId): Promise<Buffer>;
	isLocalDot(dotId: DotId): Promise<boolean>;
	getPiiMode(dotId: DotId): Promise<PiiMode>;
	defaultCountry?: string;
}

export class PiiService {
	private vaults = new Map<DotId, PiiVault>();
	private opening = new Map<DotId, Promise<PiiVault>>();

	constructor(private readonly deps: PiiServiceDeps) {}

	async shouldRedact(dotId: DotId): Promise<boolean> {
		const mode = await this.deps.getPiiMode(dotId);
		if (mode === "always") return true;
		if (mode === "off") return false;
		return !(await this.deps.isLocalDot(dotId));
	}

	private async vault(dotId: DotId): Promise<PiiVault> {
		const loaded = this.vaults.get(dotId);
		if (loaded) return loaded;
		let p = this.opening.get(dotId);
		if (!p) {
			p = PiiVault.open(this.deps.vaultFile(dotId), () => this.deps.getVaultKey(dotId));
			this.opening.set(dotId, p);
		}
		try {
			const v = await p;
			this.vaults.set(dotId, v);
			return v;
		} finally {
			this.opening.delete(dotId);
		}
	}

	async ensureVault(dotId: DotId): Promise<void> {
		await this.vault(dotId);
	}

	private async detect(text: string): Promise<PiiSpan[]> {
		const s = await this.deps.getSettings();
		return detectPii(text, {
			types: new Set<PiiType>(s.enabledTypes),
			customTerms: s.customTerms,
			detectNames: s.detectNames,
			defaultCountry: this.deps.defaultCountry,
		});
	}

	private static apply(text: string, spans: PiiSpan[], tokenFor: (s: PiiSpan) => string): string {
		let out = "";
		let pos = 0;
		for (const s of spans) {
			out += text.slice(pos, s.start) + tokenFor(s);
			pos = s.end;
		}
		return out + text.slice(pos);
	}

	async redact(dotId: DotId, text: string): Promise<{ text: string; spans: PiiSpan[] }> {
		const spans = await this.detect(text);
		if (spans.length === 0) return { text, spans };
		const vault = await this.vault(dotId);
		const redacted = PiiService.apply(text, spans, (s) => vault.tokenFor(s));
		void vault.save().catch(() => undefined);
		return { text: redacted, spans };
	}

	restore(dotId: DotId, text: string): string {
		const vault = this.vaults.get(dotId);
		return vault ? vault.restore(text) : text;
	}

	restoreDeep<T>(dotId: DotId, value: T): T {
		const vault = this.vaults.get(dotId);
		if (!vault) return value;
		const walk = (v: unknown): unknown => {
			if (typeof v === "string") return vault.restore(v);
			if (Array.isArray(v)) return v.map(walk);
			if (v && typeof v === "object" && isPlain(v)) {
				return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
			}
			return v;
		};
		return walk(value) as T;
	}

	restoreInPlace(dotId: DotId, obj: Record<string, unknown>): void {
		const vault = this.vaults.get(dotId);
		if (!vault) return;
		const walk = (container: Record<string, unknown> | unknown[]): void => {
			const rec = container as Record<string, unknown>;
			for (const k of Object.keys(rec)) {
				const v = rec[k];
				if (typeof v === "string") rec[k] = vault.restore(v);
				else if (Array.isArray(v) || (v && typeof v === "object" && isPlain(v))) {
					walk(v as Record<string, unknown> | unknown[]);
				}
			}
		};
		walk(obj);
	}

	async preview(
		text: string,
		_dotId?: DotId,
	): Promise<{ redacted: string; items: Array<{ type: PiiType; start: number; end: number }> }> {
		const spans = await this.detect(text);
		const vault = PiiVault.memory();
		return {
			redacted: PiiService.apply(text, spans, (s) => vault.tokenFor(s)),
			items: spans.map((s) => ({ type: s.type, start: s.start, end: s.end })),
		};
	}

	async destroyVault(dotId: DotId): Promise<void> {
		const vault = await this.vault(dotId);
		this.vaults.delete(dotId);
		await vault.destroy();
	}

	async flushAll(): Promise<void> {
		await Promise.all([...this.vaults.values()].map((v) => v.flush()));
	}
}

function isPlain(v: object): boolean {
	const proto = Object.getPrototypeOf(v);
	return proto === Object.prototype || proto === null;
}
