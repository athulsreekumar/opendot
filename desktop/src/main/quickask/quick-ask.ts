// The quick-ask window and its global hotkey (Spotlight-style bar). The renderer is the same bundle as the main
// window, loaded at `#/quick`; chat itself goes through the normal chat.send path.
import { BrowserWindow, globalShortcut, nativeTheme, screen } from "electron";
import type { QuickAskStatus } from "../../shared/quickask";
import { resolveQuickAsk } from "../../shared/quickask";
import type { DotId } from "../../shared/types";
import { log } from "../log";
import type { Services } from "../services";
import { clampHeight, keepOnScreen, QUICK_ASK_MIN_HEIGHT, QUICK_ASK_WIDTH, quickAskBounds } from "./bounds";
import { ShortcutManager } from "./shortcut";

export interface QuickAskDeps {
	services: Services;
	e2e: boolean;
	preloadPath: string;
	/** Load the renderer at `#/quick` into the window. */
	load(win: BrowserWindow): Promise<void>;
	/** Show the main window on a Dot's chat (creating the window if it was closed). */
	openDot(dotId: DotId): Promise<void>;
}

/** Ignore blur this long after showing: some platforms flap focus while a window appears. */
const BLUR_GRACE_MS = 300;

export class QuickAskController {
	private win: BrowserWindow | undefined;
	private readonly shortcut: ShortcutManager;
	private height = QUICK_ASK_MIN_HEIGHT;
	private pinned = false;
	private shownAt = 0;
	private offSettings: (() => void) | undefined;

	constructor(private readonly deps: QuickAskDeps) {
		this.shortcut = new ShortcutManager(globalShortcut, () => void this.toggle());
	}

	/** Register the hotkey from settings and keep it in sync. */
	async start(): Promise<void> {
		this.shortcut.apply(resolveQuickAsk(await this.deps.services.settings.get()));
		this.offSettings = this.deps.services.settings.onChange((s) => {
			this.shortcut.apply(resolveQuickAsk(s));
			if (!resolveQuickAsk(s).enabled) this.hide();
		});
	}

	status(): QuickAskStatus {
		return this.shortcut.status();
	}

	isVisible(): boolean {
		return !!this.win && !this.win.isDestroyed() && this.win.isVisible();
	}

	state() {
		const st = this.shortcut.status();
		return {
			exists: !!this.win && !this.win.isDestroyed(),
			visible: this.isVisible(),
			height: this.height,
			shortcutRegistered: st.registered && globalShortcut.isRegistered(st.accelerator),
			accelerator: st.accelerator,
		};
	}

	async toggle(): Promise<void> {
		if (this.isVisible()) this.hide();
		else await this.show();
	}

	async show(): Promise<void> {
		const win = await this.ensureWindow();
		const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
		win.setBounds(quickAskBounds(display.workArea, this.height));
		if (process.platform === "darwin") win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
		win.setAlwaysOnTop(true, "pop-up-menu");
		this.shownAt = Date.now();
		win.show();
		win.focus();
		win.webContents.focus();
		win.webContents.send("quickask:shown", {});
	}

	hide(): void {
		const win = this.win;
		this.pinned = false;
		this.deps.services.setQuickAskDot(undefined);
		if (!win || win.isDestroyed()) return;
		win.webContents.send("quickask:hidden", {});
		if (win.isVisible()) win.hide();
	}

	resize(height: number): void {
		this.height = clampHeight(height);
		const win = this.win;
		if (!win || win.isDestroyed()) return;
		const b = win.getBounds();
		if (b.height === this.height) return;
		const next = { x: b.x, y: b.y, width: b.width, height: this.height };
		win.setBounds(keepOnScreen(next, screen.getDisplayMatching(b).workArea));
	}

	report(state: { dotId?: DotId; pinned: boolean }): void {
		this.pinned = state.pinned;
		this.deps.services.setQuickAskDot(this.isVisible() ? state.dotId : undefined);
	}

	async openInApp(dotId: DotId): Promise<void> {
		this.hide();
		await this.deps.openDot(dotId);
	}

	/** Test only: behave as if another window took focus. */
	simulateBlur(): void {
		this.shownAt = 0;
		this.onBlur();
	}

	/** Drop the window (not the hotkey). Used when the last main window closes so the app can quit. */
	destroyWindow(): void {
		const win = this.win;
		this.win = undefined;
		if (win && !win.isDestroyed()) win.destroy();
	}

	dispose(): void {
		this.offSettings?.();
		this.shortcut.dispose();
		this.destroyWindow();
	}

	private onBlur(): void {
		if (this.pinned || Date.now() - this.shownAt < BLUR_GRACE_MS) return;
		this.hide();
	}

	private async ensureWindow(): Promise<BrowserWindow> {
		if (this.win && !this.win.isDestroyed()) return this.win;
		const mac = process.platform === "darwin";
		// Transparent corners need a compositor. Linux (development, CI under xvfb) gets a plain surface.
		const transparent = process.platform !== "linux";
		const theme = (await this.deps.services.settings.get()).theme;
		const dark = theme === "system" ? nativeTheme.shouldUseDarkColors : theme === "dark";
		const win = new BrowserWindow({
			width: QUICK_ASK_WIDTH,
			height: this.height,
			show: false,
			frame: false,
			resizable: false,
			movable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			skipTaskbar: true,
			alwaysOnTop: true,
			hasShadow: true,
			title: "OpenDot quick ask",
			transparent,
			backgroundColor: transparent ? "#00000000" : dark ? "#161b22" : "#ffffff",
			...(mac ? { type: "panel" as const, vibrancy: "popover" as const, visualEffectState: "active" as const } : {}),
			webPreferences: {
				preload: this.deps.preloadPath,
				contextIsolation: true,
				sandbox: true,
				nodeIntegration: false,
				webSecurity: true,
				// A hidden window still has to stream the answer and report its height.
				backgroundThrottling: false,
			},
		});
		this.win = win;
		win.on("blur", () => this.onBlur());
		win.on("closed", () => {
			if (this.win === win) this.win = undefined;
		});
		win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
		win.webContents.on("will-navigate", (e, url) => {
			if (!url.startsWith("file:") && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "\0")) e.preventDefault();
		});
		win.webContents.on("render-process-gone", () => {
			if (!win.isDestroyed()) win.reload();
		});
		try {
			await this.deps.load(win);
		} catch (e) {
			log.warn("quick ask: renderer failed to load", e);
		}
		return win;
	}
}
