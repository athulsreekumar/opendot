import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeSafeStorage } from "../../../test/unit/electron-mock";
import { createPaths, ensureBaseDirs } from "../paths";
import { SecretStore } from "../security/secret-store";
import { SettingsService } from "../settings-service";
import { Store } from "../store/store";
import { discoverModels, friendlyNetworkError } from "./discovery";
import { ModelService } from "./model-service";
import { isLocalUrl } from "./provider-presets";

function stubFetch(routes: Record<string, unknown>): typeof fetch {
	return (async (input: string | URL) => {
		const url = String(input);
		for (const [k, v] of Object.entries(routes)) {
			if (url.startsWith(k))
				return new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
		}
		throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
	}) as typeof fetch;
}

async function setup(fetchImpl: typeof fetch) {
	const root = mkdtempSync(join(tmpdir(), "od-models-"));
	const paths = createPaths(root);
	ensureBaseDirs(paths);
	process.env.PI_CODING_AGENT_DIR = paths.piDir;
	const store = new Store(paths);
	const settings = new SettingsService(store);
	const secrets = await SecretStore.create(paths.secrets, fakeSafeStorage);
	const models = await ModelService.create({ paths, settings, secrets, fetch: fetchImpl });
	return { models, settings, secrets, paths };
}

describe("discovery", () => {
	it("reads Ollama /api/tags and OpenAI /models", async () => {
		const f = stubFetch({
			"http://localhost:11434/api/tags": { models: [{ name: "llama3.2:3b" }, { name: "qwen2.5:7b" }] },
			"http://localhost:1234/v1/models": { data: [{ id: "mistral-7b" }] },
		});
		expect(await discoverModels("http://localhost:11434/v1", "ollama", { fetch: f })).toEqual([
			{ id: "llama3.2:3b" },
			{ id: "qwen2.5:7b" },
		]);
		expect(await discoverModels("http://localhost:1234/v1", "openai", { fetch: f })).toEqual([{ id: "mistral-7b" }]);
	});

	it("friendly errors and locality", () => {
		expect(
			friendlyNetworkError(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } }), "http://x"),
		).toMatch(/Nothing is listening/);
		expect(friendlyNetworkError(new Error("401 Unauthorized"))).toMatch(/API key was rejected/);
		expect(isLocalUrl("http://localhost:11434/v1")).toBe(true);
		expect(isLocalUrl("http://studio.local:1234")).toBe(true);
		expect(isLocalUrl("https://api.openai.com")).toBe(false);
	});
});

describe("ModelService", () => {
	it("adds a self-hosted Ollama provider, discovers models, sets it as default, resolves it", async () => {
		const { models, settings } = await setup(
			stubFetch({ "http://localhost:11434/api/tags": { models: [{ name: "llama3.2:3b" }] } }),
		);
		const p = await models.addProvider({ kind: "self-hosted", preset: "ollama", baseUrl: "http://localhost:11434/v1" });
		expect(p.isLocal).toBe(true);
		expect(p.models?.map((m) => m.id)).toEqual(["llama3.2:3b"]);
		const opts = await models.listModels();
		expect(opts.some((o) => o.providerId === p.id && o.modelId === "llama3.2:3b" && o.isLocal)).toBe(true);
		expect((await settings.get()).defaultModel).toEqual({ providerId: p.id, modelId: "llama3.2:3b" });
		const m = await models.resolveModel();
		expect(m.id).toBe("llama3.2:3b");
		expect(await models.isLocal()).toBe(true);
	});

	it("adds a custom OpenAI-compatible URL with manual models and keeps the key out of settings", async () => {
		const { models, settings, secrets } = await setup(stubFetch({}));
		const p = await models.addProvider({
			kind: "custom-url",
			label: "Acme Gateway",
			baseUrl: "https://llm.acme.dev/v1",
			api: "openai-completions",
			apiKey: "sk-acme-123456789",
			models: ["acme-large"],
		});
		expect(p.id).toBe("acme-gateway");
		expect(p.isLocal).toBe(false);
		expect(p.hasSecret).toBe(true);
		expect(p.secretHint).toBe("6789");
		expect(JSON.stringify(await settings.get())).not.toContain("sk-acme-123456789");
		expect(await secrets.get("provider:acme-gateway")).toBe("sk-acme-123456789");
		expect((await models.listModels()).some((o) => o.modelId === "acme-large")).toBe(true);
	});

	it("cloud providers only list models once a key is set; removing clears the default", async () => {
		const { models, settings } = await setup(stubFetch({}));
		const builtin = models.builtinProviders();
		expect(builtin.find((b) => b.id === "anthropic")?.featured).toBe(true);
		const p = await models.addProvider({
			kind: "cloud",
			builtinProviderId: "anthropic",
			apiKey: "sk-ant-test-key-0000000000",
		});
		expect((await models.listModels()).some((o) => o.providerId === p.id)).toBe(true);
		await models.removeProvider(p.id);
		expect((await models.listModels()).some((o) => o.providerId === p.id)).toBe(false);
		expect((await settings.get()).defaultModel).toBeUndefined();
		await expect(models.resolveModel()).rejects.toThrow(/Choose a model/);
	});
});
