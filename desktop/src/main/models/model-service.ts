// One pi ModelRuntime for the app; providers: cloud / self-hosted / custom URL (spec 04).
import { join } from "node:path";
import { OpenDotError } from "../../shared/errors";
import type { AddProviderInput, ModelOption, ModelRef, ProviderSettings } from "../../shared/types";
import { log } from "../log";
import type { Paths } from "../paths";
import { type Api, type Model, ModelRuntime } from "../runtime/pi-adapter";
import type { SecretStore } from "../security/secret-store";
import type { SettingsService } from "../settings-service";
import { discoverModels, friendlyNetworkError } from "./discovery";
import { FAKE_MODEL_ID, FAKE_PROVIDER_ID, FakeProvider } from "./fake-provider";
import { FEATURED_CLOUD, isLocalUrl, SELF_HOSTED_PRESETS, slugify } from "./provider-presets";

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export class ModelService {
	fake?: FakeProvider;
	private constructor(
		readonly runtime: ModelRuntime,
		private readonly settings: SettingsService,
		private readonly secrets: SecretStore,
		private readonly fetchImpl: typeof fetch,
	) {}

	static async create(deps: {
		paths: Paths;
		settings: SettingsService;
		secrets: SecretStore;
		fetch?: typeof fetch;
		fakeScriptsDir?: string;
	}): Promise<ModelService> {
		const runtime = await ModelRuntime.create({
			authPath: join(deps.paths.piDir, "auth.json"),
			modelsPath: join(deps.paths.piDir, "models.json"),
		});
		const svc = new ModelService(runtime, deps.settings, deps.secrets, deps.fetch ?? fetch);
		if (process.env.OPENDOT_FAKE_PROVIDER === "1" && deps.fakeScriptsDir) {
			svc.fake = new FakeProvider(runtime, deps.fakeScriptsDir);
		}
		await svc.registerAll();
		return svc;
	}

	/** Register every enabled provider with pi and inject runtime keys. Never throws. */
	private async registerAll(): Promise<void> {
		for (const p of (await this.settings.get()).providers) {
			try {
				await this.register(p);
			} catch (e) {
				log.warn(`Provider ${p.id} failed to register: ${(e as Error).message}`);
			}
		}
	}

	private async register(p: ProviderSettings): Promise<void> {
		const secret = await this.secrets.get(`provider:${p.id}`).catch(() => undefined);
		if (p.kind === "cloud") {
			const builtin = p.builtinProviderId ?? p.id;
			if (secret) await this.runtime.setRuntimeApiKey(builtin, secret);
			return;
		}
		if (!p.enabled) {
			this.runtime.unregisterProvider(p.id);
			return;
		}
		this.runtime.registerProvider(p.id, {
			name: p.label,
			baseUrl: p.baseUrl,
			api: (p.api ?? "openai-completions") as Api,
			apiKey: secret ?? "local",
			headers: p.headers,
			models: (p.models ?? []).map((m) => ({
				id: m.id,
				name: m.label ?? m.id,
				input: m.vision ? (["text", "image"] as ("text" | "image")[]) : (["text"] as ("text" | "image")[]),
				reasoning: !!m.reasoning,
				contextWindow: m.contextWindow ?? 32768,
				maxTokens: 8192,
				cost: ZERO_COST,
			})),
		});
	}

	async listProviders(): Promise<ProviderSettings[]> {
		const list = [...(await this.settings.get()).providers];
		if (this.fake) {
			list.unshift({
				id: FAKE_PROVIDER_ID,
				kind: "cloud",
				label: "Fake (tests)",
				isLocal: false,
				enabled: true,
				hasSecret: true,
				models: [{ id: FAKE_MODEL_ID, label: "Fake (tests)" }],
				createdAt: new Date(0).toISOString(),
			});
		}
		return list;
	}

	builtinProviders(): Array<{ id: string; label: string; keyUrl?: string; featured: boolean }> {
		const available = new Set(this.runtime.getProviders().map((p) => p.id));
		const featured = FEATURED_CLOUD.filter((p) => available.has(p.id)).map((p) => ({ ...p, featured: true }));
		const featuredIds = new Set(featured.map((f) => f.id));
		const others = this.runtime
			.getProviders()
			.filter((p) => !featuredIds.has(p.id) && p.id !== FAKE_PROVIDER_ID && !p.id.startsWith("faux"))
			.map((p) => ({ id: p.id, label: p.name, featured: false }));
		return [...featured, ...others];
	}

	async addProvider(input: AddProviderInput): Promise<ProviderSettings> {
		const s = await this.settings.get();
		const taken = new Set([...s.providers.map((p) => p.id), ...this.runtime.getProviders().map((p) => p.id)]);
		const now = new Date().toISOString();
		let p: ProviderSettings;
		if (input.kind === "cloud") {
			const meta = this.builtinProviders().find((b) => b.id === input.builtinProviderId);
			if (!meta) throw new OpenDotError("UNKNOWN_PROVIDER", `Unknown provider ${input.builtinProviderId}`);
			const existing = s.providers.find((x) => x.id === input.builtinProviderId);
			p = existing ?? {
				id: input.builtinProviderId,
				kind: "cloud",
				label: input.label ?? meta.label,
				builtinProviderId: input.builtinProviderId,
				isLocal: false,
				enabled: true,
				hasSecret: false,
				createdAt: now,
			};
		} else if (input.kind === "self-hosted") {
			const preset = SELF_HOSTED_PRESETS[input.preset];
			const id = uniqueId(slugify(input.label ?? `${input.preset}-local`), taken);
			p = {
				id,
				kind: "self-hosted",
				label: input.label ?? preset.label,
				preset: input.preset,
				baseUrl: input.baseUrl || preset.baseUrl,
				api: "openai-completions",
				isLocal: isLocalUrl(input.baseUrl || preset.baseUrl),
				enabled: true,
				hasSecret: false,
				models: [],
				createdAt: now,
			};
			try {
				p.models = await discoverModels(p.baseUrl!, preset.discovery, { fetch: this.fetchImpl, apiKey: input.apiKey });
			} catch (e) {
				log.warn(`discovery failed for ${p.baseUrl}: ${(e as Error).message}`);
			}
		} else {
			const id = uniqueId(slugify(input.label), taken);
			p = {
				id,
				kind: "custom-url",
				label: input.label,
				baseUrl: input.baseUrl,
				api: input.api,
				headers: input.headers,
				isLocal: isLocalUrl(input.baseUrl),
				enabled: true,
				hasSecret: false,
				models: (input.models ?? []).filter(Boolean).map((m) => ({ id: m })),
				createdAt: now,
			};
			if (!p.models?.length && input.api !== "anthropic-messages") {
				try {
					p.models = await discoverModels(p.baseUrl!, "openai", { fetch: this.fetchImpl, apiKey: input.apiKey });
				} catch (e) {
					log.warn(`discovery failed for ${p.baseUrl}: ${(e as Error).message}`);
				}
			}
		}
		await this.settings.update((cur) => ({
			...cur,
			providers: [...cur.providers.filter((x) => x.id !== p.id), p],
		}));
		const key = input.kind === "cloud" ? input.apiKey : input.apiKey;
		if (key) await this.setSecret(p.id, key);
		else await this.register(p);
		// First model provider becomes the default.
		const cur = await this.settings.get();
		if (!cur.defaultModel) {
			const first = (await this.listModels()).find((m) => m.providerId === p.id);
			if (first)
				await this.settings.update((c) => ({
					...c,
					defaultModel: { providerId: first.providerId, modelId: first.modelId },
				}));
		}
		return (await this.listProviders()).find((x) => x.id === p.id)!;
	}

	async updateProvider(id: string, patch: Partial<ProviderSettings>): Promise<ProviderSettings> {
		let next: ProviderSettings | undefined;
		await this.settings.update((cur) => ({
			...cur,
			providers: cur.providers.map((p) => {
				if (p.id !== id) return p;
				next = { ...p, ...patch, id: p.id, kind: p.kind };
				if (patch.baseUrl) next.isLocal = isLocalUrl(patch.baseUrl);
				return next;
			}),
		}));
		if (!next) throw new OpenDotError("NOT_FOUND", `No provider ${id}`);
		await this.register(next);
		return next;
	}

	async removeProvider(id: string): Promise<void> {
		const s = await this.settings.get();
		const p = s.providers.find((x) => x.id === id);
		if (!p) return;
		if (p.kind === "cloud") await this.runtime.removeRuntimeApiKey(p.builtinProviderId ?? p.id).catch(() => undefined);
		else this.runtime.unregisterProvider(id);
		await this.secrets.delete(`provider:${id}`);
		await this.settings.update((cur) => ({
			...cur,
			providers: cur.providers.filter((x) => x.id !== id),
			defaultModel: cur.defaultModel?.providerId === id ? undefined : cur.defaultModel,
		}));
	}

	async setSecret(id: string, secret: string): Promise<void> {
		await this.secrets.set(`provider:${id}`, secret.trim());
		await this.settings.update((cur) => ({
			...cur,
			providers: cur.providers.map((p) =>
				p.id === id ? { ...p, hasSecret: true, secretHint: secret.trim().slice(-4) } : p,
			),
		}));
		const p = (await this.settings.get()).providers.find((x) => x.id === id);
		if (p) await this.register(p);
	}

	async clearSecret(id: string): Promise<void> {
		await this.secrets.delete(`provider:${id}`);
		const s = await this.settings.update((cur) => ({
			...cur,
			providers: cur.providers.map((p) => (p.id === id ? { ...p, hasSecret: false, secretHint: undefined } : p)),
		}));
		const p = s.providers.find((x) => x.id === id);
		if (p?.kind === "cloud") await this.runtime.removeRuntimeApiKey(p.builtinProviderId ?? p.id).catch(() => undefined);
		else if (p) await this.register(p);
	}

	async discover(id: string): Promise<Array<{ id: string; label?: string }>> {
		const p = (await this.settings.get()).providers.find((x) => x.id === id);
		if (!p) throw new OpenDotError("NOT_FOUND", `No provider ${id}`);
		if (p.kind === "cloud")
			return this.runtime.getModels(p.builtinProviderId ?? p.id).map((m) => ({ id: m.id, label: m.name }));
		const kind = p.preset ? SELF_HOSTED_PRESETS[p.preset].discovery : "openai";
		const secret = await this.secrets.get(`provider:${id}`);
		const found = await discoverModels(p.baseUrl ?? "", kind, {
			fetch: this.fetchImpl,
			apiKey: secret,
			headers: p.headers,
		});
		await this.updateProvider(id, { models: found.map((m) => ({ id: m.id })) });
		return found;
	}

	async test(id: string, modelId?: string): Promise<{ ok: boolean; latencyMs?: number; message: string }> {
		const p = (await this.listProviders()).find((x) => x.id === id);
		if (!p) return { ok: false, message: "Provider not found." };
		const piProvider = p.kind === "cloud" ? (p.builtinProviderId ?? p.id) : p.id;
		const models = this.runtime.getModels(piProvider);
		const model = (modelId ? models.find((m) => m.id === modelId) : undefined) ?? models[0];
		if (!model) return { ok: false, message: "No models available for this provider." };
		const t0 = Date.now();
		let result: { ok: boolean; latencyMs?: number; message: string };
		try {
			const res = await this.runtime.completeSimple(
				model,
				{ messages: [{ role: "user", content: "Reply with: ok", timestamp: Date.now() }] },
				{ maxTokens: 16, signal: AbortSignal.timeout(20000) },
			);
			if (res.stopReason === "error") throw new Error(res.errorMessage ?? "error");
			result = { ok: true, latencyMs: Date.now() - t0, message: `Connected (${Date.now() - t0} ms).` };
		} catch (e) {
			result = { ok: false, message: friendlyNetworkError(e, p.baseUrl) };
		}
		if (p.id !== FAKE_PROVIDER_ID) {
			await this.settings.update((cur) => ({
				...cur,
				providers: cur.providers.map((x) =>
					x.id === id
						? { ...x, lastTest: { ok: result.ok, message: result.message, at: new Date().toISOString() } }
						: x,
				),
			}));
		}
		return result;
	}

	async listModels(): Promise<ModelOption[]> {
		const out: ModelOption[] = [];
		for (const p of await this.listProviders()) {
			if (!p.enabled) continue;
			if (p.kind === "cloud" && !p.hasSecret) continue;
			const piProvider = p.kind === "cloud" ? (p.builtinProviderId ?? p.id) : p.id;
			for (const m of this.runtime.getModels(piProvider)) {
				out.push({
					providerId: p.id,
					modelId: m.id,
					label: m.name || m.id,
					providerLabel: p.label,
					isLocal: p.isLocal,
					contextWindow: m.contextWindow,
					vision: (m.input ?? []).includes("image"),
					reasoning: !!m.reasoning,
				});
			}
		}
		return out;
	}

	/** Resolve a ModelRef (or the default) to a pi Model. Throws NO_MODEL. */
	async resolveModel(ref?: ModelRef): Promise<Model<Api>> {
		const s = await this.settings.get();
		const candidates = [ref, s.defaultModel].filter((r): r is ModelRef => !!r);
		for (const r of candidates) {
			const p = (await this.listProviders()).find((x) => x.id === r.providerId);
			if (!p) continue;
			const piProvider = p.kind === "cloud" ? (p.builtinProviderId ?? p.id) : p.id;
			const m = this.runtime.getModel(piProvider, r.modelId);
			if (m) return m;
		}
		throw new OpenDotError("NO_MODEL", "Choose a model in Settings → Models to start chatting.");
	}

	async isLocal(ref?: ModelRef): Promise<boolean> {
		const s = await this.settings.get();
		const r = ref ?? s.defaultModel;
		if (!r) return false;
		return !!(await this.listProviders()).find((p) => p.id === r.providerId)?.isLocal;
	}

	async describe(ref?: ModelRef): Promise<{ label: string; isLocal: boolean } | undefined> {
		const s = await this.settings.get();
		const r = ref ?? s.defaultModel;
		if (!r) return undefined;
		const opt = (await this.listModels()).find((m) => m.providerId === r.providerId && m.modelId === r.modelId);
		return opt ? { label: opt.label, isLocal: opt.isLocal } : { label: r.modelId, isLocal: await this.isLocal(r) };
	}
}

function uniqueId(base: string, taken: Set<string>): string {
	if (!taken.has(base)) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
