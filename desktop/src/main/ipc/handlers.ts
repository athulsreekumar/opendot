// Every IPC channel → service call (spec 02 §3).
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type { IpcHandlers } from "../../shared/ipc";
import type { Dot, DotId, LinkId } from "../../shared/types";
import { shellAvailable } from "../connections/shell-support";
import { draftFromDescription } from "../dots/dot-architect";
import { detectLocalServers } from "../models/discovery";
import { PI_VERSION } from "../runtime/pi-adapter";
import type { ElectronBridge, Services } from "../services";
import { watcherAvailability } from "../services";

export interface AppActions {
	openExternal(url: string): Promise<void>;
	revealPath(path: string): Promise<void>;
	pickFolder(title?: string): Promise<string | undefined>;
	/** Open a file with the OS default app. Resolves to an error message, or "" on success (Electron's shell.openPath). */
	openPath(path: string): Promise<string>;
	setLaunchAtLogin(on: boolean): Promise<void>;
	reset(): Promise<void>;
	broadcast: ElectronBridge["broadcast"];
}

export function buildHandlers(s: Services, app: AppActions, info: { version: string; e2e: boolean }): IpcHandlers {
	const dot = async (id: DotId): Promise<Dot> => s.dots.get(id);
	return {
		// ── app ──
		"app.info": async () => ({
			version: info.version,
			dataDir: s.paths.root,
			platform: process.platform,
			piVersion: PI_VERSION,
			e2e: info.e2e,
			shellAvailable: shellAvailable(),
		}),
		"app.openExternal": (url) => app.openExternal(url),
		"app.revealDataDir": () => app.revealPath(s.paths.root),
		"app.pickFolder": (o) => app.pickFolder(o?.title),
		"app.revealPath": (p) => app.revealPath(p),
		"app.setLaunchAtLogin": async (on) => {
			await app.setLaunchAtLogin(on);
			await s.settings.update((c) => ({ ...c, background: { ...c.background, launchAtLogin: on } }));
		},
		"app.reset": () => app.reset(),
		"app.getUiState": () => s.store.uiState.read(),
		"app.setUiState": async (patch) => {
			await s.store.uiState.update((c) => ({ ...c, ...patch }));
			if ("selectedDotId" in patch) s.setSelectedDot(patch.selectedDotId);
		},
		// ── settings ──
		"settings.get": () => s.settings.get(),
		"settings.update": async (patch) => {
			const prev = await s.settings.get();
			const next = await s.settings.patch(patch);
			await s.store.audit({
				kind: "settings-change",
				summary: `Settings changed: ${Object.keys(patch).join(", ")}`,
				data: {},
			});
			if (JSON.stringify(prev.localWebhook) !== JSON.stringify(next.localWebhook)) await s.restartWebhooks();
			if (prev.background.paused !== next.background.paused)
				for (const d of await s.dots.list()) s.runtime.pushHealth(d.id);
			return next;
		},
		// ── models ──
		"models.listProviders": () => s.models.listProviders(),
		"models.builtinProviders": async () => s.models.builtinProviders(),
		"models.addProvider": async (input) => {
			const p = await s.models.addProvider(input);
			await s.store.audit({ kind: "settings-change", summary: `Added provider ${p.label}`, data: { provider: p.id } });
			s.runtime.clearConfigErrors();
			return p;
		},
		"models.updateProvider": (id, patch) => s.models.updateProvider(id, patch),
		"models.removeProvider": async (id) => {
			await s.models.removeProvider(id);
			await s.store.audit({ kind: "settings-change", summary: `Removed provider ${id}`, data: { provider: id } });
		},
		"models.setSecret": async (id, secret) => {
			await s.models.setSecret(id, secret);
			s.runtime.clearConfigErrors();
		},
		"models.clearSecret": (id) => s.models.clearSecret(id),
		"models.discover": (id) => s.models.discover(id),
		"models.test": (id, modelId) => s.models.test(id, modelId),
		"models.listModels": () => s.models.listModels(),
		"models.detectLocal": () => detectLocalServers(),
		// ── dots ──
		"dots.list": () => s.dots.list(),
		"dots.get": (id) => dot(id),
		"dots.create": (input) => s.dots.create(input),
		"dots.update": (id, patch) => s.dots.update(id, patch),
		"dots.remove": (id) => s.dots.remove(id),
		"dots.duplicate": (id) => s.dots.duplicate(id),
		"dots.markRead": async (id) => {
			await s.dots.markRead(id);
			s.setSelectedDot(id);
		},
		"dots.templates": async () => s.dots.templates(),
		"dots.draftFromDescription": (input, requestId) =>
			draftFromDescription(s.models, input, {
				onDelta: requestId ? (delta) => app.broadcast("dots:draft-stream", { requestId, delta }) : undefined,
				redact: async (t) => {
					const st = await s.settings.get();
					if (await s.models.isLocal(st.defaultModel)) return t;
					return (await s.pii.preview(t)).redacted;
				},
			}),
		"dots.connectorChoices": () => s.connections.connectorChoices(),
		"dots.status": async (id) => s.runtime.peek(id)?.status ?? { kind: "idle" },
		"dots.compiledPrompt": async (id) => {
			const { compileSystemPrompt } = await import("../runtime/system-prompt");
			return compileSystemPrompt(await dot(id));
		},
		"dots.alwaysAllowed": (id) => s.policy.alwaysAllowed(id),
		"dots.forgetAllowed": (id, tool) => s.policy.forget(id, tool),
		// ── chat ──
		"chat.history": (id, opts) => s.runtime.get(id).history(opts?.before, opts?.limit),
		"chat.send": async (id, text, opts) => {
			const d = await dot(id);
			const host = s.runtime.get(id);
			// SuperBot @mention fast path (spec 13 §4).
			if (d.kind === "super" && /^@\S/.test(text.trim())) {
				const res = await superMention(s, d, text, opts?.clientNonce);
				if (res) return { accepted: true };
			}
			const r = await host.send(text, opts?.mode ?? "auto", opts?.clientNonce);
			return { accepted: true, ...r };
		},
		"chat.abort": (id) => s.runtime.get(id).abort(),
		"chat.clear": async (id) => {
			await s.runtime.get(id).clear();
			await s.dots.patchQuiet(id, (d) => ({ ...d, lastMessagePreview: "", unreadCount: 0 }));
		},
		"chat.linkHistory": (id, peer) => s.runtime.get(id).linkHistory(peer),
		// ── connections ──
		"connections.catalog": async () => s.connections.catalog(),
		"connections.list": () => s.connections.list(),
		"connections.install": (input) => s.connections.install(input),
		"connections.importJson": (json) => s.connections.importJson(json),
		"connections.update": (id, patch) => s.connections.update(id, patch),
		"connections.remove": (id) => s.connections.remove(id),
		"connections.status": async (id) =>
			(id ? [s.connections.statusOf(id)].filter((x) => !!x) : s.connections.allStatuses()) as never,
		"connections.check": (id) => s.connections.check(id),
		"connections.configureOAuth": (type, input) => s.connections.configureOAuth(type, input),
		"connections.signIn": (id) => s.connections.signIn(id),
		"connections.signOut": (id) => s.connections.signOut(id),
		"connections.macPermissions": () => s.macPermissions(),
		"connections.requestMacPermission": (cap) => s.requestMacPermission(cap),
		"connections.nodeAvailable": () => s.connections.nodeAvailable(),
		// ── approvals ──
		"approvals.pending": async () => s.approvals.pending(),
		"approvals.respond": async (res) => s.approvals.respond(res),
		// ── links ──
		"links.list": () => s.store.links.read(),
		"links.upsert": async (input) => {
			const rules = await s.store.links.read();
			const existing = input.id ? rules.find((r) => r.id === input.id) : undefined;
			const rule = {
				...input,
				id: (input.id ?? newId("lnk")) as LinkId,
				createdAt: existing?.createdAt ?? new Date().toISOString(),
			};
			await s.store.links.write([...rules.filter((r) => r.id !== rule.id), rule]);
			for (const d of await s.dots.list()) s.runtime.peek(d.id)?.markNeedsRecreate();
			return rule;
		},
		"links.remove": async (id) => {
			await s.store.links.update((rules) => rules.filter((r) => r.id !== id));
		},
		"links.exchanges": async (opts) => {
			const all = await s.store.exchanges();
			const f = opts?.dotId ? all.filter((x) => x.from === opts.dotId || x.to === opts.dotId) : all;
			return f.slice(-(opts?.limit ?? 100)).reverse();
		},
		"links.simulate": async (from, to) => s.linkBus.decide(await dot(from), await dot(to), [from]),
		// ── pii ──
		"pii.preview": (text, id) => s.pii.preview(text, id),
		// ── audit ──
		"audit.query": (q) => s.store.queryAudit(q),
		"audit.exportJsonl": async () => {
			const entries = await s.store.queryAudit({ limit: 1_000_000 });
			const path = join(homedir(), "Downloads", `opendot-audit-${new Date().toISOString().slice(0, 10)}.jsonl`);
			await writeFile(
				path,
				entries
					.reverse()
					.map((e) => JSON.stringify(e))
					.join("\n"),
			);
			return { path };
		},
		// ── watchers ──
		"watchers.list": async (id) => s.watchers.list(id),
		"watchers.create": async (input) => {
			const d = await dot(input.dotId);
			const avail = await watcherAvailability(d, input.type, await s.connections.list());
			if (!avail.available) throw new OpenDotError("UNAVAILABLE", avail.reason ?? "Not available for this Dot.");
			if (input.type === "local-webhook" && !(await s.settings.get()).localWebhook.enabled) {
				await s.settings.update((c) => ({ ...c, localWebhook: { ...c.localWebhook, enabled: true } }));
				await s.restartWebhooks();
			}
			const w = await s.watchers.create(input);
			await s.dots.refreshProfile(d.id);
			return w;
		},
		"watchers.update": async (id, patch) => {
			const w = await s.watchers.update(id, patch);
			await s.dots.refreshProfile(w.dotId);
			return w;
		},
		"watchers.remove": async (id) => {
			const w = s.watchers.get(id);
			await s.watchers.remove(id);
			await s.dots.refreshProfile(w.dotId);
		},
		"watchers.test": (input) => s.watchers.test(input),
		"watchers.runNow": (id) => s.watchers.runNow(id),
		"watchers.webhookInfo": (id) => s.watchers.webhookInfo(id),
		"watchers.types": async () => {
			// Availability is per Dot; report generic availability (any grant) here.
			const conns = await s.connections.list();
			const anyDot = (await s.dots.list())[0];
			return Promise.all(
				s.watchers.types().map(async (t) => {
					const a = anyDot
						? await watcherAvailability(
								{ ...anyDot, grants: conns.map((c) => ({ connectionId: c.id, toolRules: {} })) },
								t.type,
								conns,
							)
						: { available: true };
					return { ...t, available: a.available, reason: a.reason };
				}),
			);
		},
		// ── events ──
		"events.list": async (id, opts) => {
			const all = await s.store.latestEvents(id);
			const f = opts?.before ? all.filter((e) => e.receivedAt < opts.before!) : all;
			return f
				.slice(-(opts?.limit ?? 50))
				.reverse()
				.map(s.view);
		},
		// ── runtime ──
		"runtime.health": () => s.runtime.allHealth(),
		"runtime.pauseAll": async (paused) => {
			await s.settings.update((c) => ({ ...c, background: { ...c.background, paused } }));
			for (const d of await s.dots.list()) s.runtime.pushHealth(d.id);
		},
		"runtime.setAlwaysOn": async (id, enabled) => {
			const d = await dot(id);
			return s.dots.update(id, { alwaysOn: { ...d.alwaysOn, enabled } });
		},
		// ── superbot ──
		"superbot.get": () => s.dots.ensureSuperBot(),
		"superbot.directory": async () => {
			const sup = await s.dots.ensureSuperBot();
			const { card } = await import("../superbot/profile-service");
			const reachable = await s.linkBus.reachableFrom(sup);
			return reachable
				.filter((r) => r.dot.kind === "standard" && !r.dot.hiddenFromSuper)
				.map((r) => ({ dotId: r.dot.id, name: r.dot.name, card: card(r.dot, false) }));
		},
		"superbot.refreshProfiles": () => s.profiles.refreshAll(),
		// ── knowledge ──
		"knowledge.state": async () => s.knowledge.state(),
		"knowledge.addFolder": async (path) => {
			const f = await s.knowledge.addFolder(path);
			await s.store.audit({ kind: "connection-change", summary: `Added knowledge folder ${f.name}`, data: {} });
			return f;
		},
		"knowledge.removeFolder": (id) => s.knowledge.removeFolder(id),
		"knowledge.reindex": (id, full) => s.knowledge.reindex(id, full),
		"knowledge.open": async (path) => {
			const t = await s.knowledge.openTarget(path);
			if (t.mode === "reveal") return app.revealPath(t.path);
			const err = await app.openPath(t.path);
			if (err) await app.revealPath(t.path);
		},
		"knowledge.reveal": async (path) => app.revealPath((await s.knowledge.openTarget(path)).path),
		// ── memory ──
		"memory.get": (scope) => s.memory.list(scope),
		"memory.upsert": (scope, item) => s.memory.upsert(scope, item, "user"),
		"memory.remove": async (scope, id) => {
			await s.memory.remove(scope, id);
		},
	};
}

/** `@Name question` in Super: ask directly, stream the reply as Super's message (spec 13 §4). */
async function superMention(s: Services, superDot: Dot, text: string, _nonce?: string): Promise<boolean> {
	const m = /^@(\S+)\s+([\s\S]+)$/.exec(text.trim());
	if (!m) return false;
	const target = await s.linkBus.resolve(m[1]!);
	if (!target || target.kind === "super") return false;
	// Route through Super's normal turn with an explicit instruction; keeps context and streaming.
	await s.runtime
		.get(superDot.id)
		.send(
			`(Ask ${target.name} directly with ask_dots and relay the answer, citing [${target.name}].)\n\n${m[2]}`,
			"auto",
			_nonce,
		);
	return true;
}
