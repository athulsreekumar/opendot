// Prompt + connectors → identity & personality (spec 08 §5). Streams via onDelta.
import { z } from "zod";
import { defaultPersona } from "../../shared/defaults";
import type { ConnectorChoice, DotColor, DotDraft, SuggestedWatcher, WatcherType } from "../../shared/types";
import { DOT_COLORS } from "../../shared/types";
import { log } from "../log";
import type { ModelService } from "../models/model-service";
import { TEMPLATES } from "./templates";

const WATCHERS_FOR: Record<string, WatcherType[]> = {
	"google:gmail": ["gmail"],
	"google:calendar": ["google-calendar"],
	"google:drive": ["google-drive"],
	"microsoft:mail": ["outlook-mail"],
	"microsoft:calendar": ["outlook-calendar"],
	"microsoft:onedrive": ["onedrive"],
	"microsoft:teams": ["teams-chat"],
	"mac:files": ["folder"],
	"mac:calendar": ["mac-calendar"],
	"mac:reminders": ["mac-reminders"],
};
const ALWAYS_AVAILABLE: WatcherType[] = ["schedule", "url", "rss"];

const ArchitectSchema = z.object({
	name: z.string().min(1).max(40),
	tagline: z.string().max(120).default(""),
	emoji: z.string().min(1).max(16),
	color: z.string(),
	roles: z.array(z.string()).max(6).default([]),
	role: z.string().min(10).max(1500),
	tone: z.enum(["warm", "neutral", "playful", "direct", "formal"]).catch("neutral"),
	verbosity: z.coerce.number().catch(40),
	formality: z.coerce.number().catch(50),
	emojiUsage: z.coerce.number().catch(0),
	quirks: z.array(z.string()).default([]),
	dos: z.array(z.string()).default([]),
	donts: z.array(z.string()).default([]),
	greeting: z.string().max(400).default(""),
	alwaysOn: z.coerce.boolean().default(false),
	standingInstructions: z.string().max(800).default(""),
	suggestedWatchers: z
		.array(z.object({ type: z.string(), label: z.string(), config: z.record(z.string(), z.unknown()).default({}) }))
		.max(5)
		.default([]),
});

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export function validWatcherTypes(connectors: ConnectorChoice[]): WatcherType[] {
	const set = new Set<WatcherType>(ALWAYS_AVAILABLE);
	for (const c of connectors) for (const t of WATCHERS_FOR[c.id] ?? []) set.add(t);
	return [...set];
}

export function systemPrompt(connectors: ConnectorChoice[]): string {
	return `You design personal AI assistants ("Dots") for the OpenDot app. The user describes what the Dot should do and which connectors (tools/data
sources) it can use. Create a distinct identity and a personality that fits the job AND the connectors (e.g. an email Dot is concise and careful
about sending; a research Dot with web access cites sources). Output ONLY a JSON object, with no prose and no code fences, of this shape:
{ "name": string (≤24 chars, short and memorable, not generic like "Assistant"), "tagline": string (≤60), "emoji": one emoji,
  "color": one of [${DOT_COLORS.join(",")}],
  "roles": string[] (≤3, lowercase), "role": string (60–600 chars, second person "You are …", mention how it uses each connector),
  "tone": "warm"|"neutral"|"playful"|"direct"|"formal", "verbosity": 0–100, "formality": 0–100, "emojiUsage": 0|25|50|75|100,
  "quirks": string[] (≤2), "dos": string[] (2–5), "donts": string[] (2–5), "greeting": string (≤200, mentions what it can do with its connectors),
  "alwaysOn": boolean (true if the job involves watching for new data), "standingInstructions": string (≤400, "" if alwaysOn is false),
  "suggestedWatchers": [{ "type": one of [${validWatcherTypes(connectors).join(", ")}], "label": string, "config": object }] (≤3) }`;
}

export function userMessage(prompt: string, connectors: ConnectorChoice[]): string {
	const lines = connectors.length
		? connectors
				.map((c) => `- ${c.label} (${c.id}, ${c.kind === "installed" ? "installed" : "not yet installed"})`)
				.join("\n")
		: "none";
	return `What this Dot should do:\n${prompt}\n\nConnectors it can use:\n${lines}`;
}

export function parseDraftJson(text: string): z.infer<typeof ArchitectSchema> {
	const stripped = text
		.replace(/^[\s\S]*?```(?:json)?\s*/i, (m) => (m.includes("```") ? "" : m))
		.replace(/```[\s\S]*$/, "");
	const start = stripped.indexOf("{");
	const end = stripped.lastIndexOf("}");
	if (start < 0 || end < start) throw new Error("No JSON object in the reply.");
	return ArchitectSchema.parse(JSON.parse(stripped.slice(start, end + 1)));
}

export function toDraft(a: z.infer<typeof ArchitectSchema>, connectors: ConnectorChoice[]): DotDraft {
	const color = (DOT_COLORS as readonly string[]).includes(a.color) ? (a.color as DotColor) : "teal";
	const emoji =
		[...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(a.emoji.trim())][0]?.segment ?? "💬";
	const valid = new Set(validWatcherTypes(connectors));
	const watchers: SuggestedWatcher[] = a.suggestedWatchers
		.filter((w) => valid.has(w.type as WatcherType))
		.map((w) => ({ type: w.type as WatcherType, label: w.label.slice(0, 80), config: sanitizeConfig(w.config) }));
	const emojiSteps = [0, 25, 50, 75, 100];
	return {
		name: a.name.slice(0, 24),
		tagline: a.tagline.slice(0, 60),
		appearance: { emoji, color },
		persona: {
			role: a.role.slice(0, 600),
			tone: a.tone,
			verbosity: clamp(a.verbosity),
			formality: clamp(a.formality),
			emojiUsage: emojiSteps.reduce((p, c) => (Math.abs(c - a.emojiUsage) < Math.abs(p - a.emojiUsage) ? c : p), 0),
			quirks: a.quirks.slice(0, 2).map((q) => q.slice(0, 80)),
			dos: a.dos.slice(0, 5).map((q) => q.slice(0, 160)),
			donts: a.donts.slice(0, 5).map((q) => q.slice(0, 160)),
			customInstructions: "",
			greeting: (a.greeting || `Hi! I'm ${a.name}.`).slice(0, 200),
		},
		roles: [...new Set(a.roles.map((r) => r.toLowerCase().replace(/[^a-z0-9-]/g, "-")).filter(Boolean))].slice(0, 3),
		suggestedConnections: connectors.map((c) => c.id),
		alwaysOn: {
			enabled: a.alwaysOn && watchers.length > 0,
			standingInstructions: a.standingInstructions.slice(0, 400),
		},
		suggestedWatchers: watchers,
		piiMode: "auto",
		thinkingLevel: "low",
	};
}

function sanitizeConfig(c: Record<string, unknown>): SuggestedWatcher["config"] {
	const out: SuggestedWatcher["config"] = {};
	for (const [k, v] of Object.entries(c)) {
		if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
		else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v as string[];
		else if (Array.isArray(v) && v.every((x) => typeof x === "number")) out[k] = v as number[];
	}
	return out;
}

/** Offline fallback when no model is configured. */
export function fallbackDraft(prompt: string, connectors: ConnectorChoice[]): DotDraft {
	const words = prompt
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((w) => w.length > 2);
	const name = (
		words
			.slice(0, 2)
			.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
			.join(" ") || "New Dot"
	).slice(0, 24);
	const general = TEMPLATES.find((t) => t.id === "general");
	const persona = { ...(general?.draft.persona ?? defaultPersona(name)) };
	persona.role = `You are ${name}. ${prompt}`.slice(0, 600);
	persona.greeting =
		`Hi, I'm ${name}! ${connectors.length ? `I can use ${connectors.map((c) => c.label).join(", ")}.` : ""} What should we start with?`.slice(
			0,
			200,
		);
	return {
		name,
		tagline: prompt.slice(0, 60),
		appearance: { emoji: "💬", color: "teal" },
		persona,
		roles: ["assistant"],
		suggestedConnections: connectors.map((c) => c.id),
		suggestedWatchers: [],
		piiMode: "auto",
		thinkingLevel: "low",
	};
}

export async function draftFromDescription(
	models: ModelService,
	input: { prompt: string; connectors: ConnectorChoice[] },
	opts: { onDelta?: (d: string) => void; redact?: (s: string) => Promise<string>; signal?: AbortSignal } = {},
): Promise<DotDraft> {
	let model: Awaited<ReturnType<ModelService["resolveModel"]>>;
	try {
		model = await models.resolveModel();
	} catch {
		const d = fallbackDraft(input.prompt, input.connectors);
		opts.onDelta?.(
			JSON.stringify({ name: d.name, tagline: d.tagline, emoji: d.appearance.emoji, role: d.persona.role }),
		);
		return d;
	}
	const prompt = opts.redact ? await opts.redact(input.prompt) : input.prompt;
	const ask = async (messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<string> => {
		const stream = models.runtime.streamSimple(
			model,
			{
				systemPrompt: systemPrompt(input.connectors),
				messages: messages.map((m) =>
					m.role === "user"
						? { role: "user" as const, content: m.content, timestamp: Date.now() }
						: ({ role: "assistant", content: [{ type: "text", text: m.content }], timestamp: Date.now() } as never),
				),
			},
			{ maxTokens: 1500, signal: opts.signal ?? AbortSignal.timeout(60000) } as never,
		);
		let text = "";
		for await (const ev of stream as AsyncIterable<{
			type: string;
			delta?: string;
			error?: { errorMessage?: string };
		}>) {
			if (ev.type === "text_delta" && ev.delta) {
				text += ev.delta;
				opts.onDelta?.(ev.delta);
			} else if (ev.type === "error") throw new Error(ev.error?.errorMessage ?? "The model returned an error.");
		}
		return text;
	};
	const first = await ask([{ role: "user", content: userMessage(prompt, input.connectors) }]);
	try {
		return toDraft(parseDraftJson(first), input.connectors);
	} catch (e) {
		log.warn("draft JSON invalid, repairing", (e as Error).message);
		const second = await ask([
			{ role: "user", content: userMessage(prompt, input.connectors) },
			{ role: "assistant", content: first },
			{
				role: "user",
				content: `Your JSON was invalid: ${(e as Error).message.slice(0, 500)}. Output corrected JSON only.`,
			},
		]);
		try {
			return toDraft(parseDraftJson(second), input.connectors);
		} catch {
			// A model that can't produce JSON (e.g. the fake test model) still gets a usable Dot.
			return fallbackDraft(input.prompt, input.connectors);
		}
	}
}
