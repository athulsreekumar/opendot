// local-webhook source (spec 12 §4): push events from POST /hooks/<watcherId>.
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

export const localWebhookConfigSchema = z.object({});
export type LocalWebhookConfig = z.infer<typeof localWebhookConfigSchema>;

let counter = 0;

function toEvent(ctx: SourceCtx<LocalWebhookConfig>, raw: string, contentType: string): NewEvent {
	const now = ctx.deps.now().toISOString();
	const dedupeKey = `${ctx.watcher.id}:${Date.now()}:${counter++}`;
	let json: unknown;
	const looksJson = contentType.includes("json") || /^\s*[{[]/.test(raw);
	if (looksJson) {
		try {
			json = JSON.parse(raw);
		} catch {
			json = undefined;
		}
	}
	if (json !== undefined && json !== null && typeof json === "object") {
		const obj = json as Record<string, unknown>;
		const pretty = JSON.stringify(json, null, 2).slice(0, 4000);
		const title = typeof obj.title === "string" && obj.title ? obj.title : (pretty.split("\n")[0] ?? "Webhook");
		const imp = obj.importance === "high" || obj.importance === "low" ? obj.importance : "normal";
		return { title: title.slice(0, 200), body: pretty, facts: {}, dedupeKey, importanceHint: imp, occurredAt: now };
	}
	const text = raw.slice(0, 4000);
	const first = text.split("\n").find((l) => l.trim()) ?? "Webhook";
	return {
		title: first.trim().slice(0, 200),
		body: text,
		facts: {},
		dedupeKey,
		importanceHint: "normal",
		occurredAt: now,
	};
}

export const localWebhookSource: WatcherSource<LocalWebhookConfig> = {
	type: "local-webhook",
	label: "Local webhook",
	configSchema: localWebhookConfigSchema,
	defaultIntervalSec: 0,
	minIntervalSec: 0,
	async start(ctx) {
		const unregister = ctx.deps.webhooks.register(ctx.watcher.id, (body, contentType) => {
			try {
				ctx.emit(toEvent(ctx, body, contentType));
			} catch (e) {
				ctx.deps.log.warn("local-webhook emit failed", e);
			}
		});
		return async () => unregister();
	},
	async test(ctx) {
		return {
			ok: true,
			message: `POST JSON or text to http://127.0.0.1:<port>/hooks/${ctx.watcher.id} with the header "Authorization: Bearer <token>".`,
			sample: [],
		};
	},
};
