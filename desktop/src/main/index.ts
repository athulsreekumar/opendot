// Electron main entry. Sets pi env vars BEFORE loading anything that imports pi (spec 03 §2).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { captureWindowOptions, fakeScriptsCandidates, isCaptureMode } from "./capture";
import { createPaths, ensureBaseDirs } from "./paths";

const paths = createPaths();
ensureBaseDirs(paths);
process.env.PI_CODING_AGENT_DIR = paths.piDir;
process.env.PI_TELEMETRY = "0";
process.env.PI_SKIP_VERSION_CHECK = "1";

const {
	app,
	BrowserWindow,
	clipboard,
	desktopCapturer,
	dialog,
	ipcMain,
	Notification,
	safeStorage,
	session,
	shell,
	systemPreferences,
	nativeImage,
} = await import("electron");

const E2E = process.env.OPENDOT_E2E === "1";
// Windows groups taskbar entries and shows toast notifications under this id (must match appId in electron-builder.yml).
if (process.platform === "win32") app.setAppUserModelId("dev.opendot.app");
if (E2E && process.env.OPENDOT_E2E_USERDATA) app.setPath("userData", process.env.OPENDOT_E2E_USERDATA);

const gotLock = E2E || app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
} else {
	// Not awaited: Electron delays `ready` until top-level await settles, so awaiting here would deadlock.
	void main().catch((e) => {
		console.error("OpenDot failed to start", e);
		app.exit(1);
	});
}

async function main(): Promise<void> {
	const { log, setLogSink } = await import("./log");
	const electronLog = (await import("electron-log/main.js")).default;
	electronLog.transports.file.resolvePathFn = () => join(paths.logsDir, "main.log");
	electronLog.transports.file.maxSize = 5 * 1024 * 1024;
	setLogSink({
		debug: (m) => electronLog.debug(m),
		info: (m) => electronLog.info(m),
		warn: (m) => electronLog.warn(m),
		error: (m) => electronLog.error(m),
	});
	process.on("uncaughtException", (e) => log.error("uncaughtException", e));
	process.on("unhandledRejection", (e) => log.error("unhandledRejection", e));

	// GUI-launched apps on macOS/Linux miss the shell's PATH. Windows apps inherit the real one.
	if (process.platform !== "win32") {
		try {
			const fixPath = (await import("fix-path")).default;
			fixPath();
		} catch (e) {
			log.warn("fix-path failed", e);
		}
	}

	await app.whenReady();
	const { createServices } = await import("./services");
	const { buildHandlers } = await import("./ipc/handlers");
	const { registerIpc } = await import("./ipc/register");
	const { setupBackground } = await import("./background");

	let win: InstanceType<typeof BrowserWindow> | undefined;
	let quitting = false;
	const windows = () => BrowserWindow.getAllWindows();

	const appRoot = app.getAppPath();
	const fakeScriptsDir = fakeScriptsCandidates(process.env, appRoot, process.cwd()).find((p) => existsSync(p));

	const s = await createServices(
		paths,
		{
			safeStorage: E2E
				? {
						isEncryptionAvailable: () => true,
						encryptString: (t) => Buffer.from(`e2e:${Buffer.from(t).toString("base64")}`),
						decryptString: (b) => Buffer.from(b.toString().slice(4), "base64").toString(),
					}
				: safeStorage,
			openExternal: async (url) => {
				if (/^(https?:|mailto:|x-apple\.systempreferences:)/.test(url)) await shell.openExternal(url);
			},
			broadcast: (event, payload) => {
				for (const w of windows()) if (!w.isDestroyed()) w.webContents.send(event, payload);
			},
			isWindowFocused: () => !!win && !win.isDestroyed() && win.isVisible() && win.isFocused(),
			notify: ({ title, body, silent, dotId, scrollTo, hash }) => {
				if (!Notification.isSupported()) return;
				const n = new Notification({ title, body, silent });
				n.on("click", () => {
					showWindow();
					if (hash) win?.webContents.send("app:navigate", { hash });
					else if (dotId) win?.webContents.send("app:focus-dot", { dotId, ...(scrollTo ? { scrollTo } : {}) });
				});
				n.show();
			},
			clipboardRead: () => clipboard.readText(),
			clipboardWrite: (t) => clipboard.writeText(t),
			screenshot: async () => {
				const sources = await desktopCapturer.getSources({
					types: ["screen"],
					thumbnailSize: { width: 1600, height: 1000 },
				});
				const img = sources[0]?.thumbnail;
				if (!img) throw new Error("No screen available (check Screen Recording permission).");
				const size = img.getSize();
				return { base64Png: img.toPNG().toString("base64"), width: size.width, height: size.height };
			},
			openApp: async (name) => {
				const { openAppByName } = await import("./open-app");
				await openAppByName(name);
			},
			macProbe: {
				platform: process.platform,
				mediaStatus: (kind) =>
					process.platform === "darwin" ? systemPreferences.getMediaAccessStatus(kind) : "not-determined",
				isTrustedAccessibility: () =>
					process.platform === "darwin" ? systemPreferences.isTrustedAccessibilityClient(false) : false,
				requestScreen: async () => {
					await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } });
				},
			},
			setBadge: (count) => {
				if (process.platform === "darwin") app.dock?.setBadge(count > 0 ? String(count) : "");
				else app.setBadgeCount(count);
			},
			appVersion: app.getVersion(),
		},
		{ fakeScriptsDir },
	);

	const createWindow = async (initialHash?: string) => {
		const ui = await s.store.uiState.read();
		const b = ui.window;
		win = new BrowserWindow({
			width: b?.width ?? 1280,
			height: b?.height ?? 820,
			x: b?.x,
			y: b?.y,
			minWidth: 900,
			minHeight: 600,
			title: "OpenDot",
			show: false,
			backgroundColor: "#0a0e13",
			// macOS: hidden title bar with inset traffic lights. Windows/Linux: the native frame (the renderer reserves
			// no title bar strip there), with the menu bar tucked away until Alt is pressed.
			...(process.platform === "darwin"
				? {
						titleBarStyle: "hiddenInset" as const,
						trafficLightPosition: { x: 18, y: 18 },
						vibrancy: "sidebar" as const,
					}
				: { autoHideMenuBar: true }),
			webPreferences: {
				preload: join(import.meta.dirname, "../preload/index.cjs"),
				contextIsolation: true,
				sandbox: true,
				nodeIntegration: false,
				webSecurity: true,
				spellcheck: true,
			},
			...captureWindowOptions(process.env, process.platform),
		});
		const w = win;
		w.once("ready-to-show", () => {
			const hidden = !E2E && (app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes("--hidden"));
			if (!hidden) w.show();
		});
		w.on("closed", () => {
			// A hidden quick-ask window would keep the app from quitting once the last window is gone (Windows, Linux).
			if (process.platform !== "darwin") quickAsk?.destroyWindow();
		});
		w.on("focus", () => s.setWindowFocused(true));
		w.on("blur", () => s.setWindowFocused(false));
		w.on("close", async (e) => {
			const st = await s.settings.get().catch(() => undefined);
			if (!quitting && st?.background.runInBackground && !E2E) {
				e.preventDefault();
				w.hide();
				if (st.background.hideDockWhenClosed && process.platform === "darwin") app.dock?.hide();
			}
		});
		let boundsTimer: ReturnType<typeof setTimeout> | undefined;
		const saveBounds = () => {
			if (isCaptureMode(process.env)) return;
			if (boundsTimer) clearTimeout(boundsTimer);
			boundsTimer = setTimeout(() => {
				if (w.isDestroyed()) return;
				void s.store.uiState.update((u) => ({ ...u, window: w.getBounds() }));
			}, 500);
		};
		w.on("resize", saveBounds);
		w.on("move", saveBounds);
		w.webContents.setWindowOpenHandler(({ url }) => {
			if (/^(https:|mailto:)/.test(url)) void shell.openExternal(url);
			return { action: "deny" };
		});
		w.webContents.on("will-navigate", (e, url) => {
			if (!url.startsWith("file:") && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "\0")) e.preventDefault();
		});
		w.webContents.on("render-process-gone", () => {
			if (!w.isDestroyed()) w.reload();
		});
		if (process.env.ELECTRON_RENDERER_URL) await w.loadURL(`${process.env.ELECTRON_RENDERER_URL}${initialHash ?? ""}`);
		else
			await w.loadFile(
				join(import.meta.dirname, "../renderer/index.html"),
				initialHash ? { hash: initialHash.replace(/^#/, "") } : undefined,
			);
	};

	const showWindow = () => {
		if (!win || win.isDestroyed()) {
			void createWindow();
			return;
		}
		if (process.platform === "darwin") void app.dock?.show();
		win.show();
		win.focus();
	};

	// Quick-ask bar: the global hotkey and its small window (src/main/quickask).
	const { QuickAskController } = await import("./quickask/quick-ask");
	const quickAsk: InstanceType<typeof QuickAskController> = new QuickAskController({
		services: s,
		e2e: E2E,
		preloadPath: join(import.meta.dirname, "../preload/index.cjs"),
		load: async (w) => {
			if (process.env.ELECTRON_RENDERER_URL) await w.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/quick`);
			else await w.loadFile(join(import.meta.dirname, "../renderer/index.html"), { hash: "/quick" });
		},
		openDot: async (dotId) => {
			if (!win || win.isDestroyed()) {
				if (process.platform === "darwin") void app.dock?.show();
				await createWindow(`#/chats/${dotId}`);
				return;
			}
			showWindow();
			win.webContents.send("app:focus-dot", { dotId });
		},
	});

	// CSP via headers (dev server needs ws + inline for HMR).
	const dev = !!process.env.ELECTRON_RENDERER_URL;
	session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
		cb({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": [
					dev
						? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; img-src 'self' data: blob:"
						: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'",
				],
			},
		});
	});

	registerIpc(
		buildHandlers(
			s,
			{
				openExternal: async (url) => {
					if (/^(https:|mailto:|x-apple\.systempreferences:)/.test(url)) await shell.openExternal(url);
				},
				revealPath: async (p) => shell.showItemInFolder(p),
				pickFolder: async (title) => {
					const r = await dialog.showOpenDialog({
						title: title ?? "Choose a folder",
						properties: ["openDirectory", "createDirectory"],
					});
					return r.canceled ? undefined : r.filePaths[0];
				},
				setLaunchAtLogin: async (on) =>
					app.setLoginItemSettings({
						openAtLogin: on,
						...(process.platform === "win32" ? { args: ["--hidden"] } : {}),
					}),
				reset: async () => {
					await s.shutdown();
					const { rm } = await import("node:fs/promises");
					await rm(paths.root, { recursive: true, force: true });
					app.relaunch();
					app.exit(0);
				},
				broadcast: (event, payload) => {
					for (const w of windows()) if (!w.isDestroyed()) w.webContents.send(event, payload);
				},
				quickAsk: {
					status: () => quickAsk.status(),
					resize: (h) => quickAsk.resize(h),
					hide: () => quickAsk.hide(),
					openInApp: (id) => quickAsk.openInApp(id),
					report: (st) => quickAsk.report(st),
				},
			},
			{ version: app.getVersion(), e2e: E2E },
		),
	);

	if (E2E) {
		const { registerTestIpc } = await import("./test-ipc");
		registerTestIpc(ipcMain, s, quickAsk);
	}

	setupBackground({
		services: s,
		showWindow,
		quit: () => {
			quitting = true;
			app.quit();
		},
		trayIcon: () => {
			// macOS wants a black template image; Windows (and Linux) need a normal coloured icon.
			const mac = process.platform === "darwin";
			const file = mac ? "trayTemplate.png" : "tray.png";
			const p = [join(process.resourcesPath ?? "", file), join(appRoot, "build", file)].find((x) => existsSync(x));
			const img = p ? nativeImage.createFromPath(p) : nativeImage.createEmpty();
			if (mac) img.setTemplateImage(true);
			return img;
		},
	});

	void quickAsk.start().catch((e) => log.warn("quick ask failed to start", e));

	app.on("second-instance", () => showWindow());
	app.on("activate", () => showWindow());
	app.on("window-all-closed", () => {
		// macOS apps stay open without windows. On Windows closing the last window quits (a background-running app only
		// hides its window, so this is not reached then).
		if (E2E || process.platform === "win32") app.quit();
	});
	let shuttingDown = false;
	app.on("before-quit", (e) => {
		quitting = true;
		quickAsk.dispose();
		if (shuttingDown) return;
		shuttingDown = true;
		e.preventDefault();
		void s
			.shutdown()
			.catch((err) => log.warn("shutdown", err))
			.finally(() => app.exit(0));
	});

	await createWindow();
	log.info(`OpenDot started (data: ${paths.root})`);
}
