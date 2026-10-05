# Spec 04 — Models & providers (cloud / self-hosted / custom URL)

Owner: `src/main/models/model-service.ts` (T12). One `ModelRuntime` for the app (spec 03 §2).

## 1. Provider kinds

| Kind | What the user enters | How it maps to pi |
|---|---|---|
| **cloud** | Pick a provider + paste an API key | pi built-in provider id. `modelRuntime.setRuntimeApiKey(id, key)`. Models come from pi's catalog (`modelRuntime.getModels(id)`). |
| **self-hosted** | Preset (Ollama / LM Studio / llama.cpp / vLLM) + base URL (auto-detected) + optional key | `modelRuntime.registerProvider(id, { baseUrl, api: "openai-completions", apiKey, models })` |
| **custom-url** | Label, base URL, wire API (OpenAI chat completions / OpenAI responses / Anthropic messages), key, headers, model ids (or discover) | `modelRuntime.registerProvider(id, { baseUrl, api, apiKey, headers, models })` |

`isLocal` = hostname is `localhost`, `127.0.0.1`, `::1`, or ends with `.local`. It drives PII `auto` (spec 06).

## 2. Cloud provider list (`provider-presets.ts`)

Show these first, in this order (ids are pi built-in provider ids; verify each exists with
`modelRuntime.getProvider(id)` at startup and hide missing ones):

| id | Label | Key URL |
|---|---|---|
| `anthropic` | Anthropic (Claude) | https://console.anthropic.com/settings/keys |
| `openai` | OpenAI | https://platform.openai.com/api-keys |
| `google` | Google Gemini | https://aistudio.google.com/apikey |
| `xai` | xAI (Grok) | https://console.x.ai |
| `openrouter` | OpenRouter | https://openrouter.ai/keys |
| `groq` | Groq | https://console.groq.com/keys |
| `mistral` | Mistral | https://console.mistral.ai/api-keys |
| `deepseek` | DeepSeek | https://platform.deepseek.com/api_keys |
| `cerebras` | Cerebras | https://cloud.cerebras.ai |
| `together` | Together AI | https://api.together.ai/settings/api-keys |
| `fireworks` | Fireworks | https://fireworks.ai/account/api-keys |
| `huggingface` | Hugging Face | https://huggingface.co/settings/tokens |

"More providers…" expands to every other id from `modelRuntime.getProviders()` that uses API-key
auth (label = provider name, no key URL).

## 3. Self-hosted presets

| preset | default baseUrl | discovery | api |
|---|---|---|---|
| `ollama` | `http://localhost:11434/v1` | `GET http://localhost:11434/api/tags` → `models[].name` | `openai-completions` |
| `lmstudio` | `http://localhost:1234/v1` | `GET {baseUrl}/models` → `data[].id` | `openai-completions` |
| `llamacpp` | `http://localhost:8080/v1` | `GET {baseUrl}/models` → `data[].id` | `openai-completions` |
| `vllm` | `http://localhost:8000/v1` | `GET {baseUrl}/models` → `data[].id` | `openai-completions` |

Registration (pi's dummy-key convention from `models.md`):
```ts
modelRuntime.registerProvider(p.id, {
	name: p.label,
	baseUrl: p.baseUrl,
	api: p.api ?? "openai-completions",
	apiKey: secret ?? "local",   // pi needs some key to mark models available; local servers ignore it
	headers: p.headers,
	models: (p.models ?? []).map((m) => ({ id: m.id, name: m.label ?? m.id, contextWindow: m.contextWindow ?? 32768, input: m.vision ? ["text", "image"] : ["text"], reasoning: !!m.reasoning })),
});
```
> **Verify in T12** that `ProviderModelConfig` accepts these fields (`id`, `name`, `contextWindow`,
> `input`, `reasoning`, `cost`). Read `ProviderModelConfig` in pi's `dist/core/provider-composer.d.ts`
> or `model-config.d.ts`. If `cost` is required, pass `{ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`.

`detectLocal()`: probe all four defaults in parallel with a 600 ms timeout each and return the ones that respond.

## 4. ModelService API

```ts
export class ModelService {
	static create(deps: { paths: Paths; store: Store; secrets: SecretStore; log: Logger }): Promise<ModelService>;
	readonly runtime: ModelRuntime;
	listProviders(): ProviderSettings[];
	addProvider(input: AddProviderInput): Promise<ProviderSettings>;   // validates, tests, saves, registers
	updateProvider(id: string, patch: …): Promise<ProviderSettings>;    // re-registers
	removeProvider(id: string): Promise<void>;                           // unregister; Dots using it fall back to default model (emit dot-updated)
	setSecret(id: string, secret: string): Promise<void>;               // SecretStore `provider:<id>`; setRuntimeApiKey (cloud) or re-register (others)
	discover(id: string): Promise<Array<{ id: string; label?: string }>>;
	test(id: string, modelId?: string): Promise<{ ok: boolean; latencyMs?: number; message: string }>;
	listModels(): Promise<ModelOption[]>;   // only providers enabled AND (local OR hasSecret)
	resolveModel(ref?: ModelRef): Model;    // throws OpenDotError("NO_MODEL", …)
	isLocal(ref: ModelRef): boolean;
}
```

- `test()`: `modelRuntime.completeSimple(model, { messages: [{ role: "user", content: "Reply with: ok", timestamp: Date.now() }] }, { maxTokens: 5, signal: AbortSignal.timeout(20000) })`.
  Map errors to friendly messages: 401/403 → "The API key was rejected."; ECONNREFUSED → "Nothing is listening at <url>."; 404 → "Model '<id>' not found on this server."; timeout → "No response after 20 s."
  > Verify the `Context` shape for `completeSimple` in pi-ai `types.ts` (`TranscriptContext` / `Context`); adapt the literal in `pi-adapter.ts` helpers.
- Provider ids for user-added providers: `slug(label)` plus a `-2`, `-3` suffix on collision, and they must not collide with pi built-in ids.
- Startup: register all enabled non-cloud providers, then set runtime keys for every provider with a secret. Failures are logged and shown on the provider card. They never crash startup.

## 5. Settings → Models UI behaviour (T20, see spec 10 §6.1)

- Provider cards grouped by Cloud / On this Mac / Custom. Each card: status dot (green = tested ok,
  amber = untested, red = failing), label, model count, "Test", "Edit", "Remove".
- The default model picker lists `listModels()` grouped by provider, with a 🔒 "local" badge on local models.
- Saved keys display as `••••` plus `secretHint` (the last 4 characters, set by `setSecret`). The full key is never sent back.
- Per-Dot model override lives in the Dot Info drawer (spec 10 §4.3). "Default (<model>)" is the first option.

## 6. Fake provider (T13) — uses pi's own faux provider

```ts
import { fauxProvider, fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from "@earendil-works/pi-ai";
const faux = fauxProvider({ provider: "opendot-fake", models: [{ id: "fake-1", name: "Fake (tests)" }], tokensPerSecond: 400 });
modelRuntime.registerNativeProvider(faux.provider);
```
Enabled only when `process.env.OPENDOT_FAKE_PROVIDER === "1"`. Scripts live in
`test/fixtures/fake-scripts/<name>.json`:

```json
{ "name": "tool-then-answer",
  "steps": [
    { "content": [{ "type": "toolCall", "name": "mcp__echo__echo", "arguments": { "text": "hi" } }], "stopReason": "toolUse" },
    { "content": [{ "type": "text", "text": "The echo said hi." }] }
  ] }
```
`loadFakeScript(name)` converts steps with `fauxAssistantMessage(content, { stopReason })` and calls
`faux.setResponses(steps)`. Steps may also be the string `"$capture"`: a `FauxResponseFactory`
that records `context` into `faux.captured[]` (for the PII leak test) and replies "ok".
E2E selects a script through the env var `OPENDOT_FAKE_SCRIPT=<name>` or the test-only IPC channels
`test.setFakeScript(name)` and `test.getCaptured()` (returns the `$capture` contexts). They are registered with plain
`ipcMain.handle` only when `OPENDOT_E2E=1`, are not part of `INVOKE_CHANNELS` / `OpenDotApi`, and are reached in specs via
`page.evaluate(() => window.opendotTest.…)`, which the preload exposes only when `process.env.OPENDOT_E2E === "1"`
(read in the preload via `process.env`, which is available to sandboxed preloads in Electron).

With the fake provider enabled, `ModelService.listProviders()` includes a synthetic provider
`{ id: "opendot-fake", kind: "cloud", label: "Fake (tests)", isLocal: false, hasSecret: true, enabled: true }`, so it behaves like a
cloud provider (PII `auto` redacts) and can be picked as the default model.
