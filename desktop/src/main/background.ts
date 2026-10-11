// Menu bar tray, power/network monitors, keep-awake (spec 12 §1).
import { app, BrowserWindow, Menu, type NativeImage, net, powerMonitor, powerSaveBlocker, Tray } from "electron";
import { log } from "./log";
import type { Services } from "./services";

export function setupBackground(opts: {
	services: Services;
	showWindow: () => void;
	quit: () => void;
	trayIcon: () => NativeImage;
}): void {
	const s = opts.services;
	let tray: Tray | undefined;
	let blockerId: number | undefined;
	let rebuildTimer: ReturnType<typeof setTimeout> | undefined;

	try {
		tray = new Tray(opts.trayIcon());
		tray.setToolTip("OpenDot");
		tray.on("click", () => opts.showWindow());
	} catch (e) {
		log.warn("tray unavailable", e);
	}

	const rebuild = async () => {
		if (!tray) return;
		const dots = (await s.dots.list())
			.filter((d) => !d.archived)
			.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
		const settings = await s.settings.get();
		const running = dots.filter((d) => d.alwaysOn.enabled).length;
		const unread = dots.reduce((n, d) => n + (d.muted ? 0 : d.unreadCount), 0);
		const approvals = s.approvals.pending().length;
		tray.setTitle(process.platform === "darwin" && unread ? String(unread) : "");
		tray.setToolTip(
			`OpenDot · ${running} Dot${running === 1 ? "" : "s"} running${unread ? ` · ${unread} unread` : ""}`,
		);
		const menu = Menu.buildFromTemplate([
			{
				label: `${running} Dot${running === 1 ? "" : "s"} running${unread ? ` · ${unread} update${unread === 1 ? "" : "s"}` : ""}`,
				enabled: false,
			},
			{ label: "Open OpenDot", click: () => opts.showWindow() },
			{ type: "separator" },
			...dots.slice(0, 8).map((d) => ({
				label: `${d.appearance.emoji}  ${d.name}${d.unreadCount ? ` (${d.unreadCount})` : ""}`,
				click: () => {
					opts.showWindow();
					for (const w of BrowserWindow.getAllWindows()) w.webContents.send("app:focus-dot", { dotId: d.id });
				},
			})),
			{ type: "separator" },
			{ label: `Approvals (${approvals})…`, enabled: approvals > 0, click: () => opts.showWindow() },
			{
				label: "Pause all Dots",
				type: "checkbox",
				checked: settings.background.paused,
				click: (item) =>
					void s.settings.update((c) => ({ ...c, background: { ...c.background, paused: item.checked } })),
			},
			{
				label: "Settings…",
				click: () => {
					opts.showWindow();
					for (const w of BrowserWindow.getAllWindows())
						w.webContents.send("app:navigate", { hash: "#/settings/models" });
				},
			},
			{ type: "separator" },
			{ label: "Quit OpenDot", click: () => opts.quit() },
		]);
		tray.setContextMenu(menu);
	};
	const scheduleRebuild = () => {
		if (rebuildTimer) return;
		rebuildTimer = setTimeout(() => {
			rebuildTimer = undefined;
			void rebuild().catch(() => undefined);
		}, 1000);
	};
	void rebuild();
	s.settings.onChange(scheduleRebuild);
	s.approvals.onChange(scheduleRebuild);
	setInterval(scheduleRebuild, 15_000).unref?.();

	// Keep-awake while always-on Dots exist (opt-in).
	const syncBlocker = async () => {
		const st = await s.settings.get();
		const anyOn = (await s.dots.list()).some((d) => d.alwaysOn.enabled && !d.archived);
		const want = st.background.keepAwake && anyOn && !st.background.paused;
		if (want && blockerId === undefined) blockerId = powerSaveBlocker.start("prevent-app-suspension");
		if (!want && blockerId !== undefined) {
			powerSaveBlocker.stop(blockerId);
			blockerId = undefined;
		}
	};
	void syncBlocker();
	s.settings.onChange(() => void syncBlocker());
	setInterval(() => void syncBlocker(), 60_000).unref?.();

	powerMonitor.on("suspend", () => {
		log.info("system suspend: pausing watchers");
		s.watchers.setSuspended(true);
	});
	powerMonitor.on("resume", () => {
		log.info("system resume: catch-up in 5 s");
		setTimeout(() => {
			s.watchers.setSuspended(false);
			s.watchers.catchUp();
		}, 5000);
	});

	let online = net.isOnline();
	setInterval(() => {
		const now = net.isOnline();
		if (now === online) return;
		online = now;
		s.watchers.setSuspended(!now);
		if (now) s.watchers.catchUp();
	}, 15_000).unref?.();

	app.on("before-quit", () => {
		if (blockerId !== undefined) powerSaveBlocker.stop(blockerId);
		tray?.destroy();
	});
}
