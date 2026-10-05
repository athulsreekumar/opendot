// Installed connections (MCP, Google, Microsoft, Mac) and grants resolution (spec 05).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type {
	CatalogEntry,
	Connection,
	ConnectionId,
	ConnectionPatch,
	ConnectionStatus,
	ConnectorChoice,
	Dot,
	InstallConnectionInput,
	McpExposure,
	OAuthClientInput,
} from "../../shared/types";
import { log } from "../log";
import { runLoopbackFlow } from "../oauth/loopback";
import { OAuthTokenStore } from "../oauth/token-store";
import { McpClient, type McpServerConfig, StdioTransport, StreamableHttpTransport } from "../runtime/pi-adapter";
import type { SecretStore } from "../security/secret-store";
import type { Store } from "../store/store";
import { CATALOG } from "./catalog";
import { fetchGoogleAccount, googleOAuthConfig } from "./google/config";
import { fetchMicrosoftAccount, microsoftOAuthConfig } from "./microsoft/config";
import { nativeToolCatalog } from "./native-catalog";
import type { OAuthProviderConfig } from "./native-types";

const pexec = promisify(execFile);

export const GOOGLE_FEATURES = ["gmail", "calendar", "drive"] as const;
export const MICROSOFT_FEATURES = ["mail", "calendar", "onedrive", "teams"] as const;
export const MAC_FEATURES = [
	"files",
	"shell",
	"calendar",
	"reminders",
	"contacts",
	"notes",
	"screen",
	"clipboard",
	"notifications",
	"open",
] as const;

const SECRET_REF = /\$\{secret:([A-Za-z0-9_]+)\}/g;

export interface ConnectionEmitter {
	status(s: ConnectionStatus): void;
	changed(list: Connection[]): void;
}

function sanitizeName(s: string): string {
	return (
		s
			.replace(/[^A-Za-z0-9_-]/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 40) || "server"
	);
}

export class ConnectionService {
	private readonly statuses = new Map<ConnectionId, ConnectionStatus>();
	private readonly changeListeners = new Set<(ids: ConnectionId[]) => void>();
	readonly tokens: OAuthTokenStore;
	/** Set by services: OAuth sign-in for remote MCP servers through pi. */
	mcpSignIn?: (c: Connection, cfg: McpServerConfig) => Promise<{ ok: boolean; message: string }>;

	constructor(
		private readonly store: Store,
		private readonly secrets: SecretStore,
		private readonly emit: ConnectionEmitter,
		private readonly openUrl: (url: string) => void | Promise<void>,
	) {
		this.tokens = new OAuthTokenStore(secrets);
	}

	catalog(): CatalogEntry[] {
		return CATALOG;
	}

	list(): Promise<Connection[]> {
		return this.store.connections.read();
	}

	async get(id: ConnectionId): Promise<Connection> {
		const c = (await this.list()).find((x) => x.id === id);
		if (!c) throw new OpenDotError("NOT_FOUND", "Connection not found.");
		return c;
	}

	/** Make sure the singleton mac / google / microsoft connections exist (google/microsoft start unconfigured). */
	async ensureBuiltins(): Promise<void> {
		const list = await this.list();
		const now = new Date().toISOString();
		const add: Connection[] = [];
		if (!list.some((c) => c.type === "mac")) {
			add.push({
				id: newId("con"),
				type: "mac",
				name: "mac",
				label: "This Mac",
				description: "Files, shell, Calendar, Reminders, Contacts, Notes, screen, clipboard and more.",
				icon: "laptop",
				enabled: true,
				exposure: "direct",
				toolExposure: {},
				features: [...MAC_FEATURES],
				createdAt: now,
			});
		}
		for (const [type, label, icon, desc] of [
			["google", "Google Workspace", "mail", "Gmail, Google Calendar and Drive."],
			["microsoft", "Microsoft 365", "calendar", "Outlook mail and calendar, OneDrive and Teams."],
		] as const) {
			if (!list.some((c) => c.type === type)) {
				add.push({
					id: newId("con"),
					type,
					name: type,
					label,
					description: desc,
					icon,
					enabled: true,
					exposure: "direct",
					toolExposure: {},
					features: [],
					configured: false,
					createdAt: now,
				});
			}
		}
		if (add.length) await this.save([...list, ...add]);
	}

	byType(list: Connection[], type: Connection["type"]): Connection | undefined {
		return list.find((c) => c.type === type);
	}

	private async save(next: Connection[]): Promise<void> {
		await this.store.connections.write(next);
		this.emit.changed(next);
	}

	async install(input: InstallConnectionInput): Promise<Connection> {
		const list = await this.list();
		const now = new Date().toISOString();
		const id = newId("con");
		let conn: Connection;
		const secrets: Record<string, string> = {};
		if ("catalogId" in input) {
			const entry = CATALOG.find((e) => e.id === input.catalogId);
			if (!entry) throw new OpenDotError("NOT_FOUND", `Unknown catalog entry ${input.catalogId}`);
			const fill = (s: string) => s.replace(/\{([A-Z0-9_]+)\}/g, (_m, k: string) => input.inputs[k] ?? "");
			const env: Record<string, string> = { ...(entry.stdio?.env ?? {}) };
			const headers: Record<string, string> = { ...(entry.http?.headers ?? {}) };
			for (const inp of entry.inputs) {
				const v = input.inputs[inp.key] ?? "";
				if (inp.secret) secrets[inp.key] = v;
				else if (inp.target === "env") env[inp.key] = v;
				else if (inp.target === "header" && !Object.values(headers).some((h) => h.includes(`\${secret:${inp.key}}`))) {
					headers[inp.key] = v;
				}
				if (inp.secret && inp.target === "env") env[inp.key] = `\${secret:${inp.key}}`;
			}
			conn = {
				id,
				type: entry.type,
				name: this.uniqueName(input.name ?? entry.id, list),
				label: entry.label,
				description: entry.description,
				icon: entry.icon,
				catalogId: entry.id,
				enabled: true,
				stdio: entry.stdio
					? { command: entry.stdio.command, args: entry.stdio.args.map(fill), env, cwd: entry.stdio.cwd }
					: undefined,
				http: entry.http ? { url: fill(entry.http.url), headers, oauth: entry.http.oauth } : undefined,
				exposure: entry.defaultExposure,
				toolExposure: {},
				features: [],
				createdAt: now,
			};
		} else {
			const c = input.custom;
			if (c.type === "mcp-stdio") {
				const env = { ...c.env };
				for (const [k, v] of Object.entries(c.secretEnv)) {
					secrets[k] = v;
					env[k] = `\${secret:${k}}`;
				}
				conn = {
					id,
					type: "mcp-stdio",
					name: this.uniqueName(c.name, list),
					label: c.label || c.name,
					description: `${c.command} ${c.args.join(" ")}`.slice(0, 200),
					icon: "terminal",
					enabled: true,
					stdio: { command: c.command, args: c.args, env },
					exposure: "deferred",
					toolExposure: {},
					features: [],
					createdAt: now,
				};
			} else {
				if (/\/sse\/?$/.test(c.url)) {
					throw new OpenDotError(
						"SSE_UNSUPPORTED",
						"SSE endpoints aren't supported. Try the same URL ending in /mcp instead of /sse.",
					);
				}
				const headers = { ...c.headers };
				for (const [k, v] of Object.entries(c.secretHeaders)) {
					const key = sanitizeName(k).replace(/-/g, "_").toUpperCase();
					secrets[key] = v;
					headers[k] = `\${secret:${key}}`;
				}
				conn = {
					id,
					type: "mcp-http",
					name: this.uniqueName(c.name, list),
					label: c.label || c.name,
					description: c.url,
					icon: "globe",
					enabled: true,
					http: { url: c.url, headers },
					exposure: "deferred",
					toolExposure: {},
					features: [],
					createdAt: now,
				};
			}
		}
		for (const [k, v] of Object.entries(secrets)) if (v) await this.secrets.set(`conn:${id}:${k}`, v);
		await this.save([...list, conn]);
		await this.store.audit({
			kind: "connection-change",
			summary: `Installed ${conn.label}`,
			data: { connection: conn.name },
		});
		// Default exposure from the tool count (≤ 15 tools → direct).
		void this.check(id)
			.then(async (st) => {
				if (st.state === "connected" && !("catalogId" in input)) {
					await this.update(id, { exposure: st.toolCount <= 15 ? "direct" : "deferred" });
				}
			})
			.catch(() => undefined);
		this.notifyChange([id]);
		return conn;
	}

	private uniqueName(base: string, list: Connection[]): string {
		const norm = (s: string) => s.toLowerCase().replace(/-/g, "_");
		const taken = new Set(list.map((c) => norm(c.name)));
		let name = sanitizeName(base);
		for (let i = 2; taken.has(norm(name)); i++) name = `${sanitizeName(base)}-${i}`;
		return name;
	}

	/** Claude Desktop / Cursor / VS Code mcpServers JSON (spec 05 §2.2). */
	async importJson(json: string): Promise<{ added: Connection[]; errors: string[] }> {
		const errors: string[] = [];
		const added: Connection[] = [];
		let parsed: unknown;
		try {
			parsed = JSON.parse(json);
		} catch (e) {
			return { added, errors: [`Not valid JSON: ${(e as Error).message}`] };
		}
		const obj = parsed as Record<string, unknown>;
		let servers: Record<string, Record<string, unknown>> = {};
		if (obj.mcpServers && typeof obj.mcpServers === "object") servers = obj.mcpServers as typeof servers;
		else if (obj.servers && typeof obj.servers === "object") servers = obj.servers as typeof servers;
		else if (obj.command || obj.url) servers = { imported: obj };
		else return { added, errors: ["No mcpServers found."] };
		const looksSecret = (k: string, v: string) =>
			/(KEY|TOKEN|SECRET|PASSWORD|AUTH)/i.test(k) || /^(sk-|ghp_|xox|AIza|Bearer )/.test(v);
		for (const [name, cfg] of Object.entries(servers)) {
			try {
				const resolve = (v: string) => v.replace(/\$\{input:[^}]+\}/g, "");
				if (typeof cfg.command === "string") {
					const env: Record<string, string> = {};
					const secretEnv: Record<string, string> = {};
					for (const [k, v] of Object.entries((cfg.env as Record<string, string>) ?? {})) {
						if (looksSecret(k, String(v))) secretEnv[k] = resolve(String(v));
						else env[k] = resolve(String(v));
					}
					added.push(
						await this.install({
							custom: {
								type: "mcp-stdio",
								name,
								command: cfg.command,
								args: ((cfg.args as string[]) ?? []).map(resolve),
								env,
								secretEnv,
							},
						}),
					);
				} else if (typeof cfg.url === "string") {
					if (cfg.type === "sse") throw new Error("SSE servers are not supported");
					const headers: Record<string, string> = {};
					const secretHeaders: Record<string, string> = {};
					for (const [k, v] of Object.entries((cfg.headers as Record<string, string>) ?? {})) {
						if (looksSecret(k, String(v))) secretHeaders[k] = resolve(String(v));
						else headers[k] = resolve(String(v));
					}
					added.push(await this.install({ custom: { type: "mcp-http", name, url: cfg.url, headers, secretHeaders } }));
				} else errors.push(`${name}: needs "command" or "url"`);
			} catch (e) {
				errors.push(`${name}: ${(e as Error).message}`);
			}
		}
		return { added, errors };
	}

	async update(id: ConnectionId, patch: ConnectionPatch): Promise<Connection> {
		const list = await this.list();
		const i = list.findIndex((c) => c.id === id);
		if (i < 0) throw new OpenDotError("NOT_FOUND", "Connection not found.");
		const cur = list[i]!;
		const { secrets, stdio, http, ...rest } = patch;
		const next: Connection = {
			...cur,
			...rest,
			stdio: stdio && cur.stdio ? { ...cur.stdio, ...stdio } : cur.stdio,
			http: http && cur.http ? { ...cur.http, ...http } : cur.http,
		};
		if (secrets) for (const [k, v] of Object.entries(secrets)) await this.secrets.set(`conn:${id}:${k}`, v);
		list[i] = next;
		await this.save(list);
		this.notifyChange([id]);
		return next;
	}

	async remove(id: ConnectionId): Promise<void> {
		const list = await this.list();
		const c = list.find((x) => x.id === id);
		if (!c) return;
		if (c.type === "mac") throw new OpenDotError("BUILTIN", "The Mac connection can't be removed. Disable it instead.");
		await this.secrets.deletePrefix(`conn:${id}:`);
		await this.secrets.delete(`oauth:${id}`);
		await this.secrets.delete(`oauthclient:${id}`);
		if (c.type === "google" || c.type === "microsoft") {
			// Built-ins reset to unconfigured instead of disappearing.
			await this.save(
				list.map((x) => (x.id === id ? { ...x, configured: false, account: undefined, features: [] } : x)),
			);
		} else {
			await this.save(list.filter((x) => x.id !== id));
		}
		for (const d of await this.store.dots.list()) {
			if (d.grants.some((g) => g.connectionId === id) && c.type !== "google" && c.type !== "microsoft") {
				await this.store.dots.update(d.id, (dd) => ({ ...dd, grants: dd.grants.filter((g) => g.connectionId !== id) }));
			}
		}
		this.statuses.delete(id);
		await this.store.audit({ kind: "connection-change", summary: `Removed ${c.label}`, data: { connection: c.name } });
		this.notifyChange([id]);
	}

	// ── secrets & config resolution ──
	private async resolveSecrets(id: ConnectionId, rec: Record<string, string>): Promise<Record<string, string>> {
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(rec)) {
			let val = v;
			for (const m of v.matchAll(SECRET_REF)) {
				const s = (await this.secrets.get(`conn:${id}:${m[1]}`)) ?? "";
				val = val.replace(m[0], s);
			}
			out[k] = val;
		}
		return out;
	}

	async mcpConfig(c: Connection): Promise<McpServerConfig> {
		const common = { exposure: c.exposure, toolExposure: c.toolExposure, description: c.description, timeout: 60 };
		if (c.stdio) {
			return {
				command: c.stdio.command,
				args: c.stdio.args,
				env: await this.resolveSecrets(c.id, c.stdio.env),
				...(c.stdio.cwd ? { cwd: c.stdio.cwd } : {}),
				...common,
			} as unknown as McpServerConfig;
		}
		return {
			url: c.http!.url,
			headers: await this.resolveSecrets(c.id, c.http!.headers),
			...(c.http?.oauth ? { oauth: c.http.oauth } : {}),
			...common,
		} as unknown as McpServerConfig;
	}

	/** What a Dot gets from its grants (spec 05 §1). */
	async resolveForDot(dot: Dot): Promise<{
		mcpServers: Array<{ name: string; config: McpServerConfig; connection: Connection }>;
		native: Array<{ connection: Connection; features: string[] }>;
	}> {
		const list = await this.list();
		const mcpServers: Array<{ name: string; config: McpServerConfig; connection: Connection }> = [];
		const native: Array<{ connection: Connection; features: string[] }> = [];
		const mcpGrants = dot.grants.filter((g) => list.find((c) => c.id === g.connectionId)?.type.startsWith("mcp"));
		for (const g of dot.grants) {
			const c = list.find((x) => x.id === g.connectionId);
			if (!c?.enabled) continue;
			if (c.type === "mcp-stdio" || c.type === "mcp-http") {
				const cfg = await this.mcpConfig(c);
				// Large fleets: load on demand (spec 05 §2.4).
				if (mcpGrants.length > 8 && (cfg as { exposure?: McpExposure }).exposure === "direct") {
					(cfg as { exposure?: McpExposure }).exposure = "deferred";
				}
				mcpServers.push({ name: c.name, config: cfg, connection: c });
			} else {
				if ((c.type === "google" || c.type === "microsoft") && !c.configured) continue;
				const granted = g.features?.length
					? g.features.filter((f) => c.features.includes(f) || f.startsWith("folder:"))
					: c.features;
				native.push({ connection: c, features: granted });
			}
		}
		return { mcpServers, native };
	}

	// ── status / check ──
	statusOf(id: ConnectionId): ConnectionStatus | undefined {
		return this.statuses.get(id);
	}

	allStatuses(): ConnectionStatus[] {
		return [...this.statuses.values()];
	}

	reportStatus(s: ConnectionStatus): void {
		const prev = this.statuses.get(s.connectionId);
		if (prev && prev.state === "connected" && s.state !== "connected" && prev.checkedAt > s.checkedAt) return;
		const merged = { ...prev, ...s, tools: s.tools.length ? s.tools : (prev?.tools ?? []) };
		this.statuses.set(s.connectionId, merged);
		this.emit.status(merged);
	}

	async check(id: ConnectionId): Promise<ConnectionStatus> {
		const c = await this.get(id);
		const now = () => new Date().toISOString();
		if (c.type === "google" || c.type === "microsoft") {
			// Built-in tools are known without connecting, so list them even before sign-in.
			const tools = nativeToolCatalog(c);
			const st: ConnectionStatus = {
				connectionId: id,
				state: !c.configured ? "disconnected" : (await this.secrets.has(`oauth:${id}`)) ? "connected" : "needs-auth",
				toolCount: tools.length,
				tools,
				checkedAt: now(),
			};
			this.reportStatus(st);
			return st;
		}
		if (c.type === "mac") {
			const tools = nativeToolCatalog(c);
			const st: ConnectionStatus = {
				connectionId: id,
				state: c.enabled ? "connected" : "disabled",
				toolCount: tools.length,
				tools,
				checkedAt: now(),
			};
			this.reportStatus(st);
			return st;
		}
		this.reportStatus({ connectionId: id, state: "connecting", toolCount: 0, tools: [], checkedAt: now() });
		let stderr = "";
		let client: InstanceType<typeof McpClient> | undefined;
		try {
			const cfg = (await this.mcpConfig(c)) as {
				command?: string;
				args?: string[];
				env?: Record<string, string>;
				cwd?: string;
				url?: string;
				headers?: Record<string, string>;
			};
			const transport = c.stdio
				? new StdioTransport({
						command: cfg.command!,
						args: cfg.args ?? [],
						env: { ...(process.env as Record<string, string>), ...(cfg.env ?? {}) },
						...(cfg.cwd ? { cwd: cfg.cwd } : {}),
						onStderr: (chunk: string) => {
							stderr = (stderr + chunk).slice(-2048);
						},
					} as never)
				: new StreamableHttpTransport({ url: cfg.url!, headers: cfg.headers ?? {} } as never);
			client = new McpClient({ name: "OpenDot", version: "0.1.0" });
			await withTimeout(client.connect(transport as never), 20000, "Timed out connecting (20 s).");
			const tools = (await withTimeout(client.listTools(), 15000, "Timed out listing tools.")) as Array<{
				name: string;
				description?: string;
				annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
			}>;
			const st: ConnectionStatus = {
				connectionId: id,
				state: "connected",
				toolCount: tools.length,
				tools: tools.map((t) => ({
					name: t.name,
					description: (t.description ?? "").split("\n")[0]!.slice(0, 200),
					exposure: c.toolExposure[t.name] ?? c.exposure,
					readOnly: t.annotations?.readOnlyHint === true,
					destructive: t.annotations?.destructiveHint === true,
				})),
				checkedAt: now(),
			};
			this.reportStatus(st);
			return st;
		} catch (e) {
			const msg = (e as Error).message ?? String(e);
			const needsAuth = /401|403|unauthori[sz]ed|oauth/i.test(msg);
			const notFound = /ENOENT/.test(msg);
			const st: ConnectionStatus = {
				connectionId: id,
				state: needsAuth ? "needs-auth" : "error",
				toolCount: 0,
				tools: [],
				error: notFound
					? `Command not found: ${c.stdio?.command} (is it installed? Node.js provides npx; uv provides uvx)`
					: msg.slice(0, 500),
				stderrTail: stderr || undefined,
				checkedAt: now(),
			};
			this.reportStatus(st);
			return st;
		} finally {
			await client?.close().catch(() => undefined);
		}
	}

	// ── OAuth for native stacks ──
	async configureOAuth(type: "google" | "microsoft", input: OAuthClientInput): Promise<Connection> {
		const list = await this.list();
		const c = this.byType(list, type);
		if (!c) throw new OpenDotError("NOT_FOUND", `No ${type} connection.`);
		await this.secrets.set(
			`oauthclient:${c.id}`,
			JSON.stringify({ clientId: input.clientId.trim(), clientSecret: input.clientSecret?.trim() }),
		);
		return this.update(c.id, { features: input.features });
	}

	async oauthConfig(c: Connection): Promise<OAuthProviderConfig> {
		const raw = await this.secrets.get(`oauthclient:${c.id}`);
		if (!raw) throw new OpenDotError("NOT_CONFIGURED", `Set up ${c.label} first (client ID).`);
		const { clientId, clientSecret } = JSON.parse(raw) as { clientId: string; clientSecret?: string };
		return c.type === "google"
			? googleOAuthConfig(clientId, clientSecret ?? "", c.features)
			: microsoftOAuthConfig(clientId, c.features);
	}

	async signIn(id: ConnectionId): Promise<{ account?: string }> {
		const c = await this.get(id);
		if (c.type === "mcp-http") {
			if (!this.mcpSignIn) throw new OpenDotError("UNSUPPORTED", "Sign-in isn't available right now.");
			const r = await this.mcpSignIn(c, await this.mcpConfig(c));
			if (!r.ok) throw new OpenDotError("SIGNIN_FAILED", r.message);
			await this.check(id).catch(() => undefined);
			this.notifyChange([id]);
			return {};
		}
		if (c.type !== "google" && c.type !== "microsoft") {
			throw new OpenDotError("UNSUPPORTED", "Local servers don't need a sign-in.");
		}
		const cfg = await this.oauthConfig(c);
		const tokens = await runLoopbackFlow(cfg, { openUrl: (u) => this.openUrl(u) });
		await this.tokens.save(id, tokens);
		const account =
			c.type === "google"
				? await fetchGoogleAccount(tokens.access_token).catch(() => undefined)
				: await fetchMicrosoftAccount(tokens.access_token, fetch).catch(() => undefined);
		await this.update(id, {});
		const list = await this.list();
		await this.save(list.map((x) => (x.id === id ? { ...x, configured: true, account } : x)));
		await this.check(id);
		this.notifyChange([id]);
		return { account };
	}

	async signOut(id: ConnectionId): Promise<void> {
		await this.tokens.clear(id);
		const list = await this.list();
		await this.save(list.map((x) => (x.id === id ? { ...x, account: undefined } : x)));
		await this.check(id).catch(() => undefined);
		this.notifyChange([id]);
	}

	async accessToken(type: "google" | "microsoft"): Promise<string> {
		const c = this.byType(await this.list(), type);
		if (!c) throw new OpenDotError("NOT_FOUND", `No ${type} connection.`);
		return this.tokens.getAccessToken(c.id, await this.oauthConfig(c));
	}

	async nodeAvailable(): Promise<{ node?: string; npx: boolean; uvx: boolean }> {
		const has = async (cmd: string) => {
			try {
				await pexec("which", [cmd]);
				return true;
			} catch {
				return false;
			}
		};
		let node: string | undefined;
		try {
			node = (await pexec("node", ["-v"])).stdout.trim();
		} catch {
			node = undefined;
		}
		return { node, npx: await has("npx"), uvx: await has("uvx") };
	}

	/** Connectors offered when creating a Dot (spec 08 §5). */
	async connectorChoices(): Promise<ConnectorChoice[]> {
		const list = await this.list();
		const out: ConnectorChoice[] = [];
		const google = this.byType(list, "google");
		const ms = this.byType(list, "microsoft");
		const mac = this.byType(list, "mac");
		const gLabels: Record<string, string> = { gmail: "Gmail", calendar: "Google Calendar", drive: "Google Drive" };
		const mLabels: Record<string, string> = {
			mail: "Outlook Mail",
			calendar: "Outlook Calendar",
			onedrive: "OneDrive",
			teams: "Teams",
		};
		const macLabels: Record<string, string> = {
			files: "Files",
			shell: "Shell (Terminal)",
			calendar: "Mac Calendar",
			reminders: "Reminders",
			contacts: "Contacts",
			notes: "Notes",
			screen: "Screenshots",
			clipboard: "Clipboard",
			notifications: "Notifications",
			open: "Open apps & links",
		};
		const icons: Record<string, string> = {
			gmail: "mail",
			mail: "mail",
			calendar: "calendar",
			drive: "folder",
			onedrive: "folder",
			teams: "message-circle",
		};
		for (const f of GOOGLE_FEATURES) {
			const installed = !!google?.configured && google.features.includes(f);
			out.push({
				id: `google:${f}`,
				label: gLabels[f]!,
				kind: installed ? "installed" : "available",
				icon: icons[f] ?? "globe",
				group: "Google",
				features: [f],
			});
		}
		for (const f of MICROSOFT_FEATURES) {
			const installed = !!ms?.configured && ms.features.includes(f);
			out.push({
				id: `microsoft:${f}`,
				label: mLabels[f]!,
				kind: installed ? "installed" : "available",
				icon: icons[f] ?? "globe",
				group: "Microsoft",
				features: [f],
			});
		}
		for (const f of MAC_FEATURES) {
			out.push({
				id: `mac:${f}`,
				label: macLabels[f]!,
				kind: mac?.enabled ? "installed" : "available",
				icon: "laptop",
				group: "Mac",
				features: [f],
			});
		}
		for (const c of list.filter((x) => x.type === "mcp-stdio" || x.type === "mcp-http")) {
			out.push({ id: c.id, label: c.label, kind: "installed", icon: c.icon, group: "MCP" });
		}
		const installedCatalog = new Set(list.map((c) => c.catalogId).filter(Boolean));
		for (const e of CATALOG.filter((x) => x.verified && !installedCatalog.has(x.id))) {
			out.push({ id: e.id, label: e.label, kind: "available", icon: e.icon, group: "MCP" });
		}
		return out;
	}

	/** Map a chosen connector id to a grant, if its connection is installed. */
	async grantFor(choiceId: string): Promise<{ connectionId: ConnectionId; features?: string[] } | undefined> {
		const list = await this.list();
		if (choiceId.startsWith("con_"))
			return list.some((c) => c.id === choiceId) ? { connectionId: choiceId as ConnectionId } : undefined;
		const [type, feature] = choiceId.split(":");
		if (type === "google" || type === "microsoft" || type === "mac") {
			const c = this.byType(list, type);
			if (!c) return undefined;
			if (type !== "mac" && (!c.configured || !c.features.includes(feature!))) return undefined;
			return { connectionId: c.id, features: feature ? [feature] : undefined };
		}
		const byCatalog = list.find((c) => c.catalogId === choiceId);
		return byCatalog ? { connectionId: byCatalog.id } : undefined;
	}

	onChange(fn: (ids: ConnectionId[]) => void): () => void {
		this.changeListeners.add(fn);
		return () => this.changeListeners.delete(fn);
	}

	notifyChange(ids: ConnectionId[]): void {
		for (const l of this.changeListeners) {
			try {
				l(ids);
			} catch (e) {
				log.warn("connection change listener", e);
			}
		}
	}
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(msg)), ms);
		p.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			},
		);
	});
}
