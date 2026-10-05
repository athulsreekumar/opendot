import type { SelfHostedPreset } from "../../shared/types";

/** Featured cloud providers (spec 04 §2). Ids are pi built-in provider ids. */
export const FEATURED_CLOUD: Array<{ id: string; label: string; keyUrl: string }> = [
	{ id: "anthropic", label: "Anthropic (Claude)", keyUrl: "https://console.anthropic.com/settings/keys" },
	{ id: "openai", label: "OpenAI", keyUrl: "https://platform.openai.com/api-keys" },
	{ id: "google", label: "Google Gemini", keyUrl: "https://aistudio.google.com/apikey" },
	{ id: "xai", label: "xAI (Grok)", keyUrl: "https://console.x.ai" },
	{ id: "openrouter", label: "OpenRouter", keyUrl: "https://openrouter.ai/keys" },
	{ id: "groq", label: "Groq", keyUrl: "https://console.groq.com/keys" },
	{ id: "mistral", label: "Mistral", keyUrl: "https://console.mistral.ai/api-keys" },
	{ id: "deepseek", label: "DeepSeek", keyUrl: "https://platform.deepseek.com/api_keys" },
	{ id: "cerebras", label: "Cerebras", keyUrl: "https://cloud.cerebras.ai" },
	{ id: "together", label: "Together AI", keyUrl: "https://api.together.ai/settings/api-keys" },
	{ id: "fireworks", label: "Fireworks", keyUrl: "https://fireworks.ai/account/api-keys" },
	{ id: "huggingface", label: "Hugging Face", keyUrl: "https://huggingface.co/settings/tokens" },
];

export const SELF_HOSTED_PRESETS: Record<
	SelfHostedPreset,
	{ label: string; baseUrl: string; discovery: "ollama" | "openai" }
> = {
	ollama: { label: "Ollama", baseUrl: "http://localhost:11434/v1", discovery: "ollama" },
	lmstudio: { label: "LM Studio", baseUrl: "http://localhost:1234/v1", discovery: "openai" },
	llamacpp: { label: "llama.cpp", baseUrl: "http://localhost:8080/v1", discovery: "openai" },
	vllm: { label: "vLLM", baseUrl: "http://localhost:8000/v1", discovery: "openai" },
};

export function isLocalUrl(url: string | undefined): boolean {
	if (!url) return false;
	try {
		const h = new URL(url).hostname.replace(/^\[|\]$/g, "");
		return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".local") || h === "0.0.0.0";
	} catch {
		return false;
	}
}

export function slugify(s: string): string {
	return (
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 32) || "provider"
	);
}
