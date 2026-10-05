import type { AppSettings } from "../shared/types";
import type { Store } from "./store/store";

type Listener = (s: AppSettings) => void;

/** Thin wrapper over settings.json that broadcasts changes. */
export class SettingsService {
	private readonly listeners = new Set<Listener>();
	constructor(private readonly store: Store) {}

	get(): Promise<AppSettings> {
		return this.store.settings.read();
	}

	async update(fn: (cur: AppSettings) => AppSettings): Promise<AppSettings> {
		const next = await this.store.settings.update(fn);
		for (const l of this.listeners) l(next);
		return next;
	}

	async patch(patch: Partial<AppSettings>): Promise<AppSettings> {
		return this.update((cur) => ({ ...cur, ...patch, version: 1, telemetry: false, providers: cur.providers }));
	}

	onChange(l: Listener): () => void {
		this.listeners.add(l);
		return () => this.listeners.delete(l);
	}
}
