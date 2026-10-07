// Composition root: builds every service in dependency order (spec 01 §6, PLAN §3).
// Electron APIs come in through `ElectronBridge` so this file also runs in tests.
import { join } from "node:path";
import { OpenDotError } from "../shared/errors";
import type { EventMap } from "../shared/ipc";
import { builtinComputerLabel, MAC_ONLY_WATCHERS, platformFeatures } from "../shared/platform";
import type { AppSettings, Connection, Dot, DotId, LinkExchange, MacPermissionStatus } from "../shared/types";
import { ConnectionService } from "./connections/connection-service";
import { MAC_DEFAULT_DECISIONS } from "./connections/mac";
import { runJxaReal } from "./connections/mac/jxa";
import { shellAvailable } from "./connections/shell-support";
import { DotService } from "./dots/dot-service";
import { KnowledgeService } from "./knowledge/knowledge-service";
import { LinkBus } from "./links/link-bus";
import { log } from "./log";
import { MemoryService } from "./memory/memory-service";
import { ModelService } from "./models/model-service";
import type { Paths } from "./paths";
import { PiiService } from "./pii/pii-service";
import type { SessionCtx } from "./runtime/dot-host";
import { DotRuntime } from "./runtime/dot-runtime";
import { linksExtension } from "./runtime/extensions/links";
import { mcpExtensions } from "./runtime/extensions/mcp";
import { memoryExtension } from "./runtime/extensions/memory";
import { nativeOwner, nativeToolsExtension } from "./runtime/extensions/native-tools";
import { piiExtension } from "./runtime/extensions/pii";
import { policyExtension } from "./runtime/extensions/policy";
import { sectionsExtension } from "./runtime/extensions/sections";
import { superbotExtension } from "./runtime/extensions/superbot";
import { type InlineExtension, McpClient, StdioTransport, StreamableHttpTransport } from "./runtime/pi-adapter";
import { blocksText } from "./runtime/views";
import { ApprovalBroker } from "./security/approval-broker";
import { PolicyEngine } from "./security/policy-engine";
import { type SafeStorageLike, SecretStore } from "./security/secret-store";
import { SettingsService } from "./settings-service";
import { Store } from "./store/store";
import { buildDirectory, ProfileService } from "./superbot/profile-service";
import { EventRouter, view } from "./watchers/event-router";
import { type McpLikeClient, NeedsAuthError, type SourceDeps } from "./watchers/types";
import { UsageTracker } from "./watchers/usage";
import { WatcherService } from "./watchers/watcher-service";
import { WebhookServer } from "./watchers/webhook-server";

export interface ElectronBridge {
	safeStorage: SafeStorageLike;
	openExternal(url: string): Promise<void>;
	broadcast<E extends keyof EventMap>(event: E, payload: EventMap[E]): void;
	isWindowFocused(): boolean;
	notify(opts: { title: string; body: string; silent?: boolean; dotId?: DotId }): void;
	clipboardRead(): string | Promise<string>;
	clipboardWrite(t: string): void;
	screenshot(): Promise<{ base64Png: string; width: number; height: number }>;
	openApp(name: string): Promise<void>;
	macProbe: {
		mediaStatus(kind: "screen"): string;
		isTrustedAccessibility(): boolean;
		requestScreen?(): Promise<void>;
		platform: string;
	};
	setBadge(count: number): void;
	appVersion: string;
}

export type Services = Awaited<ReturnType<typeof createServices>>;

export async function createServices(paths: Paths, bridge: ElectronBridge, opts: { fakeScriptsDir?: string } = {}) {
	const store = new Store(paths);
	const settings = new SettingsService(store);
	const secrets = await SecretStore.create(paths.secrets, bridge.safeStorage);
	const models = await ModelService.create({ paths, settings, secrets, fakeScriptsDir: opts.fakeScriptsDir });
	const memory = new MemoryService(store);
	const policy = new PolicyEngine(store);
	const approvals = new ApprovalBroker({
		requested: (r) => {
			bridge.broadcast("approval:requested", r);
			if (!bridge.isWindowFocused()) bridge.notify({ title: "Approval needed", body: r.title, dotId: r.dotId });
			runtime?.get(r.dotId) && runtime.pushHealth(r.dotId);
			emitStatus(r.dotId, { kind: "waiting-approval" });
		},
		resolved: (id, decision) => bridge.broadcast("approval:resolved", { id, decision }),
	});
	const usage = new UsageTracker(store);
	await usage.load();

	const getDot = (id: DotId) => store.dots.get(id);
	const emitStatus = (
		dotId: DotId,
		status: Parameters<typeof bridge.broadcast<"dot:event">>[1] extends infer E
			? E extends { type: "status"; status: infer S }
				? S
				: never
			: never,
	) => bridge.broadcast("dot:event", { type: "status", dotId, status });

	const pii = new PiiService({
		getSettings: async () => (await settings.get()).pii,
		vaultFile: (id) => paths.dotVault(id),
		getVaultKey: async (id) => {
			const k = `pii:${id}`;
			let v = await secrets.get(k);
			if (!v) {
				v = (await import("node:crypto")).randomBytes(32).toString("base64");
				await secrets.set(k, v);
			}
			return Buffer.from(v, "base64");
		},
		isLocalDot: async (id) => models.isLocal((await getDot(id))?.model),
		getPiiMode: async (id) => (await getDot(id))?.piiMode ?? "auto",
	});

	const connections = new ConnectionService(
		store,
		secrets,
		{
			status: (s) => bridge.broadcast("connection:status", s),
			changed: (list) => bridge.broadcast("connections:changed", list),
		},
		(url) => bridge.openExternal(url),
	);
	await connections.ensureBuiltins();
	connections.mcpSignIn = async (c, cfg) => {
		const { signInMcpServer } = await import("./connections/mcp-signin");
		return signInMcpServer(c, cfg, { paths, models, openUrl: (u) => void bridge.openExternal(u) });
	};

	const dots = new DotService(store, paths, connections);

	// ── Knowledge (local notes index). Loads in the background so startup never waits on it. ──
	const knowledge = new KnowledgeService({
		dir: join(paths.root, "knowledge"),
		emit: (state) => bridge.broadcast("knowledge:changed", state),
		watchDebounceMs: process.env.OPENDOT_E2E ? 300 : undefined,
	});
	void knowledge.start().catch((e) => log.warn("knowledge start failed", e));

	// ── Link bus (needs runtime; resolved lazily) ──
	let runtime: DotRuntime;
	const talking = new Map<DotId, DotId>();
	const linkBus = new LinkBus({
		store,
		approvals,
		pii,
		settings: () => settings.get(),
		host: (id) => runtime.get(id),
		emitExchange: (x: LinkExchange) => bridge.broadcast("link:exchange", x),
		setTalking: (from, to) => {
			if (to) {
				talking.set(from, to);
				emitStatus(from, { kind: "talking-to", peerDotId: to });
			} else {
				talking.delete(from);
			}
		},
	});

	const profiles = new ProfileService(store, models, pii);

	// ── Watchers (always-on) ──
	const webhooks = new WebhookServer();
	const sourceDeps: SourceDeps = {
		fetch: (...a) => fetch(...a),
		log,
		getAccessToken: (type) =>
			connections.accessToken(type).catch((e) => {
				throw e instanceof OpenDotError && e.code === "NOT_CONFIGURED" ? new NeedsAuthError(e.message) : e;
			}),
		runJxa: (s, t) => runJxaReal(s, t),
		mcpClient: (connectionId) => openMcpClient(connectionId),
		webhooks,
		now: () => new Date(),
	};
	const openMcpClient = async (connectionId: string): Promise<McpLikeClient> => {
		const c = (await connections.list()).find((x) => x.id === connectionId);
		if (!c) throw new Error("Connection not found.");
		const cfg = (await connections.mcpConfig(c)) as {
			command?: string;
			args?: string[];
			env?: Record<string, string>;
			url?: string;
			headers?: Record<string, string>;
		};
		const transport = c.stdio
			? new StdioTransport({
					command: cfg.command!,
					args: cfg.args ?? [],
					env: { ...(process.env as Record<string, string>), ...(cfg.env ?? {}) },
				} as never)
			: new StreamableHttpTransport({ url: cfg.url!, headers: cfg.headers ?? {} } as never);
		const client = new McpClient({ name: "OpenDot", version: bridge.appVersion });
		const init = (await client.connect(transport as never)) as {
			capabilities?: { resources?: { subscribe?: boolean } };
		};
		return {
			request: (m, p) => client.request(m, p as never) as never,
			onNotification: (m, l) => client.onNotification(m, l as never),
			readResource: (uri) => client.readResource(uri) as never,
			callTool: (n, a) => client.callTool(n, a) as never,
			capabilities: () => init?.capabilities,
			close: () => client.close(),
		};
	};

	const router = new EventRouter({
		store,
		usage,
		settings: () => settings.get(),
		getDot,
		isLocalModel: (d) => models.isLocal(d.model),
		deliver: async (dot, content, events) => {
			try {
				await runtime.get(dot.id).deliverEvents(content, events);
			} catch (e) {
				runtime.fail(dot, e);
				throw e;
			}
		},
		emitReceived: (dotId, events) => bridge.broadcast("dot:event", { type: "events-received", dotId, events }),
		onOverBudget: (dot, waiting, reason) =>
			bridge.notify({
				title: `${dot.name} paused`,
				body: `${reason}. ${waiting} event${waiting === 1 ? "" : "s"} waiting.`,
				dotId: dot.id,
				silent: true,
			}),
		onHealth: (dotId) => runtime?.pushHealth(dotId),
	});

	const watchers = new WatcherService({
		store,
		paths,
		sourceDeps,
		getDot,
		isPaused: async () => (await settings.get()).background.paused,
		availability: async (dot, type) => watcherAvailability(dot, type, await connections.list()),
		onEvent: (dot, w, ev) => void router.receive(dot, w, ev).catch((e) => log.warn("event receive failed", e)),
		onChanged: (w) => {
			bridge.broadcast("watcher:changed", w);
			runtime?.pushHealth(w.dotId);
		},
		webhookToken: async (id) => {
			let t = await secrets.get(`webhook:${id}`);
			if (!t) {
				t = (await import("node:crypto")).randomBytes(24).toString("base64url");
				await secrets.set(`webhook:${id}`, t);
			}
			return t;
		},
		webhookPort: () => webhooks.port || (settingsCache?.localWebhook.port ?? 47615),
		minIntervalOverride: process.env.OPENDOT_E2E_MIN_INTERVAL
			? Number(process.env.OPENDOT_E2E_MIN_INTERVAL)
			: undefined,
	});
	let settingsCache: AppSettings | undefined = await settings.get();
	settings.onChange((s) => {
		settingsCache = s;
		bridge.broadcast("settings:changed", s);
	});

	// ── Extensions per session ──
	const allowedRoots = (dot: Dot) => [
		dot.workspaceDir,
		...dot.grants.flatMap((g) => (g.features ?? []).filter((f) => f.startsWith("folder:")).map((f) => f.slice(7))),
	];
	const builtinsFor = (dot: Dot, conns: Connection[]): string[] => {
		const mac = conns.find((c) => c.type === "mac");
		const g = mac?.enabled ? dot.grants.find((x) => x.connectionId === mac.id) : undefined;
		if (!g) return [];
		const feats = platformFeatures(g.features?.length ? g.features : mac!.features, process.platform);
		const out: string[] = [];
		if (feats.includes("files")) out.push("read", "write", "edit", "ls", "grep", "find");
		// Never offer the model a shell that cannot start (Windows without Git Bash).
		if (feats.includes("shell") && shellAvailable()) out.push("bash");
		return out;
	};
	let connCache: Connection[] = await connections.list();
	const refreshConnCache = async () => {
		connCache = await connections.list();
	};
	const connectionFor = (dot: Dot, toolName: string): Connection | undefined => {
		const mcp = /^mcp__(.+?)__/.exec(toolName);
		if (mcp)
			return connCache.find(
				(c) => c.name.replace(/[^A-Za-z0-9_]/g, "_") === mcp[1] && dot.grants.some((g) => g.connectionId === c.id),
			);
		const owner = nativeOwner(toolName);
		return owner ? connCache.find((c) => c.type === owner) : undefined;
	};

	const buildExtensions = async (dot: Dot, ctx: SessionCtx): Promise<InlineExtension[]> => {
		await refreshConnCache();
		const resolved = await connections.resolveForDot(dot);
		const getFresh = async () => (await getDot(dot.id)) ?? dot;
		const exts: InlineExtension[] = [
			piiExtension(
				pii,
				dot.id,
				(count, types) =>
					void store.audit({
						kind: "pii-redaction",
						dotId: dot.id,
						summary: `Masked ${count} item(s): ${types.join(", ")}`,
						data: { count },
					}),
			),
			policyExtension({
				policy,
				approvals,
				getDot: getFresh,
				connectionFor,
				nativeDefault: (t) => MAC_DEFAULT_DECISIONS[t] ?? (t.startsWith("knowledge_") ? "allow" : undefined),
				allowedRoots,
				audit: (kind, d, summary, data) => void store.audit({ kind, dotId: d.id, summary, data }),
				approvalTtlMs: () => (runtime.peek(dot.id)?.status.kind === "handling-events" ? 30 * 60_000 : 5 * 60_000),
			}),
			sectionsExtension({
				getDot: getFresh,
				shouldRedact: () => pii.shouldRedact(dot.id),
				memory,
				capabilities: async (d) => d.profile.capabilities,
				dataSources: async (d) => d.profile.dataSources,
				reachableDots: async (d) => (await linkBus.reachableFrom(d)).map((r) => r.dot.name),
				directory: dot.kind === "super" ? (d, q) => buildDirectory(store, linkBus, d, q) : undefined,
				kind: ctx.kind,
			}),
			memoryExtension(memory, dot.id),
			linksExtension({
				bus: linkBus,
				getDot: getFresh,
				chain: ctx.chain,
				emitPeer: (tc, peer, status, patch) => runtime.get(dot.id).emitPeer(tc, peer, status, patch),
			}),
			nativeToolsExtension({
				grants: resolved.native,
				base: { fetch: (...a) => fetch(...a), runJxa: (s, t) => runJxaReal(s, t), now: () => new Date() },
				accessToken: (type) => connections.accessToken(type),
				knowledge: {
					search: (q, limit) => knowledge.search(q, limit),
					read: (p, a, b) => knowledge.read(p, a, b),
					busy: () => knowledge.busy(),
					folderCount: () => knowledge.roots().length,
				},
				mac: {
					clipboardRead: () => bridge.clipboardRead(),
					clipboardWrite: (t) => bridge.clipboardWrite(t),
					screenshot: () => bridge.screenshot(),
					notify: (title, body) => bridge.notify({ title, body, dotId: dot.id }),
					openUrl: (u) => bridge.openExternal(u),
					openApp: (n) => bridge.openApp(n),
				},
			}),
			...mcpExtensions({
				servers: resolved.mcpServers,
				logPath: join(paths.piDir, "mcp.log"),
				openUrl: (u) => void bridge.openExternal(u),
				reportStatus: (s) => connections.reportStatus(s),
			}),
		];
		if (dot.kind === "super") {
			exts.push(
				superbotExtension({
					bus: linkBus,
					getDot: getFresh,
					emitPeer: (tc, peer, status, patch) => runtime.get(dot.id).emitPeer(tc, peer, status, patch),
					updates: (ref, since, limit) => profiles.updates(linkBus, ref, since, limit),
					searchHistory: (ref, q, limit) => profiles.searchHistory(linkBus, ref, q, limit),
				}),
			);
		}
		return exts;
	};

	// ── Runtime ──
	let windowFocused = true;
	const isFocused = (id: DotId) => windowFocused && uiSelected === id;
	let uiSelected: DotId | undefined = (await store.uiState.read()).selectedDotId;

	runtime = new DotRuntime(
		{
			paths,
			store,
			settings,
			models,
			pii,
			emit: (e) => bridge.broadcast("dot:event", e),
			buildExtensions,
			grantedBuiltins: (dot) => builtinsFor(dot, connCache),
			getDot,
			updateDot: (id, fn) => store.dots.update(id, fn),
			isFocused,
			onCancelApprovals: (id) => approvals.cancelForDot(id),
			onAssistantEnd: (info) => {
				usage.recordCost(info.dot.id, info.costUsd);
				if (info.eventIds?.length) void store.setEventStatus(info.dot.id, info.eventIds, "handled");
				void updateBadge();
				runtime.pushHealth(info.dot.id);
				if (info.hidden || !info.text.trim()) return;
				void maybeNotify(info.dot, info.text, info.importance, info.runKind);
				// Knowledge summaries (spec 13 §3).
				if (info.dot.kind === "standard") profiles.noteActivity(info.dot.id);
			},
		},
		{
			listDots: () => store.dots.list(),
			watchers: (dotId) =>
				watchers.list(dotId).map((w) => ({
					id: w.id,
					label: w.label,
					type: w.type,
					state: w.state,
					lastRunAt: w.lastRunAt,
					nextRunAt: w.nextRunAt,
					lastError: w.lastError,
					lastEventAt: w.lastEventAt,
				})),
			queued: (id) => router.queued(id),
			overBudget: (id) => router.overBudget(id),
			turnsLastHour: (id) => usage.turnsLastHour(id),
			costToday: (id) => usage.costToday(id),
			paused: async () => (await settings.get()).background.paused,
			emitHealth: (h) => bridge.broadcast("runtime:health", h),
			notifyError: (dot, message) => bridge.notify({ title: dot.name, body: message, dotId: dot.id }),
			idleMinutes: async () => (await settings.get()).runtime.idleDisposeMinutes,
			hasPendingApprovals: (id) => approvals.hasPending(id),
		},
		() => settingsCache?.runtime.maxConcurrentRuns ?? 4,
	);

	const maybeNotify = async (dot: Dot, text: string, importance: string | undefined, runKind: string) => {
		const s = await settings.get();
		if (!s.notifications.enabled || dot.muted) return;
		const background = runKind === "events";
		if (background) {
			if (importance === "urgent") {
				/* always */
			} else if (dot.alwaysOn.notify !== "updates") return;
			else if (dot.alwaysOn.quietHours) {
				const { isOpen } = await import("./links/schedule");
				if (isOpen(dot.alwaysOn.quietHours, new Date())) return;
			}
		} else if (isFocused(dot.id)) return;
		bridge.notify({
			title: importance === "urgent" ? `⚠ ${dot.name}` : dot.name,
			body: s.notifications.showPreview ? text.replace(/\s+/g, " ").slice(0, 180) : "New message",
			silent: !s.notifications.sound,
			dotId: dot.id,
		});
	};

	const updateBadge = async () => {
		const total = (await store.dots.list()).reduce((s, d) => s + (d.muted ? 0 : d.unreadCount), 0);
		bridge.setBadge(total);
	};

	// ── Hooks between services ──
	dots.hooks = {
		broadcast: (list) => {
			bridge.broadcast("dots:changed", list);
			void updateBadge();
		},
		onCreated: async (dot, suggested) => {
			for (const w of suggested) {
				const avail = await watcherAvailability(dot, w.type, await connections.list());
				if (!avail.available) continue;
				await watchers
					.create({ dotId: dot.id, type: w.type, label: w.label, config: w.config, intervalSec: w.intervalSec })
					.catch((e) => log.warn("suggested watcher skipped", (e as Error).message));
			}
			await dots.refreshProfile(dot.id);
			if (dot.alwaysOn.enabled) await runtime.warm((await getDot(dot.id)) ?? dot);
		},
		onUpdated: async (prev, next) => {
			await runtime.peek(next.id)?.applyDotChange(prev, next);
			if (prev.alwaysOn.enabled !== next.alwaysOn.enabled) {
				await watchers.syncPush();
				if (next.alwaysOn.enabled) await runtime.warm(next);
			}
			runtime.pushHealth(next.id);
		},
		onRemoved: async (dot) => {
			await runtime.disposeDot(dot.id);
			await watchers.removeForDot(dot.id);
			await pii.destroyVault(dot.id).catch(() => undefined);
		},
	};

	connections.onChange(() => {
		void (async () => {
			await refreshConnCache();
			await dots.applyPendingGrants();
			for (const d of await store.dots.list()) {
				await dots.refreshProfile(d.id);
				runtime.peek(d.id)?.markNeedsRecreate();
			}
			watchers.resetAuth();
			await watchers.syncPush();
		})().catch((e) => log.warn("connection change handling failed", e));
	});

	settings.onChange(() => runtime.clearConfigErrors());

	// ── Start ──
	await dots.ensureSuperBot();
	const st = await settings.get();
	if (st.localWebhook.enabled) {
		await webhooks
			.start(st.localWebhook.port, async (id) => secrets.get(`webhook:${id}`))
			.catch((e) => log.warn("webhook server failed to start", e));
	}
	await watchers.start();
	runtime.start();
	profiles.start(runtime);

	return {
		paths,
		store,
		settings,
		secrets,
		models,
		memory,
		policy,
		approvals,
		pii,
		connections,
		knowledge,
		dots,
		linkBus,
		profiles,
		watchers,
		router,
		usage,
		runtime,
		webhooks,
		setWindowFocused(f: boolean) {
			windowFocused = f;
		},
		setSelectedDot(id?: DotId) {
			uiSelected = id;
		},
		macPermissions: async (): Promise<MacPermissionStatus[]> => {
			const { getMacPermissions } = await import("./connections/mac/permissions");
			return getMacPermissions({ ...bridge.macProbe, runJxa: (s: string, t?: number) => runJxaReal(s, t) } as never);
		},
		requestMacPermission: async (
			cap: Parameters<typeof import("./connections/mac/permissions").requestMacPermission>[0],
		) => {
			const { requestMacPermission } = await import("./connections/mac/permissions");
			return requestMacPermission(cap, {
				...bridge.macProbe,
				runJxa: (s: string, t?: number) => runJxaReal(s, t),
			} as never);
		},
		async restartWebhooks() {
			await webhooks.stop().catch(() => undefined);
			const s = await settings.get();
			if (s.localWebhook.enabled) await webhooks.start(s.localWebhook.port, async (id) => secrets.get(`webhook:${id}`));
		},
		async shutdown() {
			await watchers.stop();
			await knowledge.stop().catch(() => undefined);
			router.stop();
			profiles.stop();
			await runtime.disposeAll();
			await usage.save();
			await pii.flushAll();
			await webhooks.stop().catch(() => undefined);
		},
		lastAssistantText: (content: unknown) => blocksText(content),
		view,
	};
}

export async function watcherAvailability(
	dot: Dot,
	type: string,
	conns: Connection[],
): Promise<{ available: boolean; reason?: string }> {
	const needs: Record<string, [Connection["type"], string]> = {
		gmail: ["google", "gmail"],
		"google-calendar": ["google", "calendar"],
		"google-drive": ["google", "drive"],
		"outlook-mail": ["microsoft", "mail"],
		"outlook-calendar": ["microsoft", "calendar"],
		onedrive: ["microsoft", "onedrive"],
		"teams-chat": ["microsoft", "teams"],
		"mac-calendar": ["mac", "calendar"],
		"mac-reminders": ["mac", "reminders"],
		folder: ["mac", "files"],
	};
	const req = needs[type];
	if (!req) return { available: true };
	const c = conns.find((x) => x.type === req[0]);
	if ((MAC_ONLY_WATCHERS as readonly string[]).includes(type) && process.platform === "win32")
		return { available: false, reason: "Only available on a Mac" };
	const label =
		{ google: "Google", microsoft: "Microsoft 365", mac: builtinComputerLabel(process.platform) }[req[0] as "google"] ??
		req[0];
	if (!c || ((req[0] === "google" || req[0] === "microsoft") && !c.configured))
		return { available: false, reason: `Connect ${label} first` };
	if (req[0] !== "mac" && !c.features.includes(req[1]))
		return { available: false, reason: `Enable ${req[1]} in ${label}` };
	const g = dot.grants.find((x) => x.connectionId === c.id);
	if (!g) return { available: false, reason: `Allow ${label} for this Dot (Tools)` };
	if (g.features?.length && !g.features.includes(req[1]))
		return { available: false, reason: `Allow ${req[1]} for this Dot` };
	return { available: true };
}
