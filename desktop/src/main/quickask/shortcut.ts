// Registers the global quick-ask hotkey and reports whether it worked. Electron's globalShortcut comes in as an
// interface so this runs in unit tests.
import { QUICK_ASK_IN_USE, type QuickAskStatus } from "../../shared/quickask";
import type { QuickAskSettings } from "../../shared/types";
import { log } from "../log";

export interface ShortcutApi {
	register(accelerator: string, callback: () => void): boolean;
	unregister(accelerator: string): void;
}

export class ShortcutManager {
	private active: string | undefined;
	private current: QuickAskStatus = { enabled: false, accelerator: "", registered: false };

	constructor(
		private readonly api: ShortcutApi,
		private readonly onPress: () => void,
	) {}

	status(): QuickAskStatus {
		return { ...this.current };
	}

	/** Make the registered hotkey match the settings. Safe to call on every settings change. */
	apply(settings: QuickAskSettings): QuickAskStatus {
		const want = settings.enabled ? settings.shortcut : undefined;
		if (this.active && this.active !== want) {
			try {
				this.api.unregister(this.active);
			} catch (e) {
				log.warn("quick ask: unregister failed", e);
			}
			this.active = undefined;
		}
		if (!want) {
			this.current = { enabled: false, accelerator: settings.shortcut, registered: false };
			return this.status();
		}
		if (this.active === want) return this.status();
		let ok = false;
		try {
			ok = this.api.register(want, this.onPress);
		} catch (e) {
			log.warn("quick ask: register threw", e);
		}
		if (ok) this.active = want;
		else log.warn(`quick ask: could not register ${want}`);
		this.current = ok
			? { enabled: true, accelerator: want, registered: true }
			: { enabled: true, accelerator: want, registered: false, error: QUICK_ASK_IN_USE };
		return this.status();
	}

	dispose(): void {
		if (this.active) {
			try {
				this.api.unregister(this.active);
			} catch {
				// quitting anyway
			}
		}
		this.active = undefined;
		this.current = { ...this.current, registered: false };
	}
}
