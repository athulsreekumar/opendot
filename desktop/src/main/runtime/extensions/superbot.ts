// SuperBot tools: ask_dots (parallel fan-out), get_dot_updates, search_dot_history (spec 13 §4).
import type { Dot, DotId } from "../../../shared/types";
import type { LinkBus } from "../../links/link-bus";
import { defineTool, type InlineExtension, Type } from "../pi-adapter";

export interface SuperExtDeps {
	bus: LinkBus;
	getDot: () => Promise<Dot>;
	emitPeer: (
		toolCallId: string,
		peer: DotId,
		status: "queued" | "running" | "done" | "error" | "blocked",
		patch?: { delta?: string; text?: string; error?: string },
	) => void;
	updates: (dotRef: string | undefined, sinceMs: number, limit: number) => Promise<string>;
	searchHistory: (dotRef: string, query: string, limit: number) => Promise<string>;
}

function parseSince(s?: string): number {
	if (!s || s === "today") {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}
	const m = /^(\d+)\s*(h|d|m)$/.exec(s.trim());
	if (m) return Date.now() - Number(m[1]) * (m[2] === "h" ? 3600_000 : m[2] === "d" ? 86400_000 : 60_000);
	const t = Date.parse(s);
	return Number.isNaN(t) ? Date.now() - 86400_000 : t;
}

export function superbotExtension(deps: SuperExtDeps): InlineExtension {
	return {
		name: "opendot-superbot",
		hidden: true,
		factory: (api) => {
			api.registerTool(
				defineTool({
					name: "ask_dots",
					label: "Ask Dots",
					description:
						"Ask one or more Dots in parallel and wait for all replies. Give each a self-contained question. Use this once with every Dot you need.",
					parameters: Type.Object({
						requests: Type.Array(Type.Object({ dot: Type.String(), question: Type.String() }), {
							minItems: 1,
							maxItems: 6,
						}),
					}),
					annotations: { readOnlyHint: true },
					executionMode: "parallel",
					async execute(toolCallId, p, signal) {
						const me = await deps.getDot();
						const results = await Promise.all(
							p.requests.map(async (r) => {
								const t0 = Date.now();
								let acc = "";
								const res = await deps.bus.send(me, r.dot, r.question, [me.id], {
									signal,
									onStatus: (to, status, detail) =>
										deps.emitPeer(toolCallId, to.id, status, {
											error: status === "error" || status === "blocked" ? detail : undefined,
										}),
									onDelta: (to, delta) => {
										acc += delta;
										deps.emitPeer(toolCallId, to.id, "running", { delta });
									},
								});
								if (res.to)
									deps.emitPeer(
										toolCallId,
										res.to.id,
										res.ok ? "done" : "error",
										res.ok ? { text: res.reply } : { error: res.reason, text: acc },
									);
								return {
									name: res.to?.name ?? r.dot,
									ok: res.ok,
									text: res.ok ? res.reply : res.reason,
									ms: Date.now() - t0,
								};
							}),
						);
						const text = results.map((r) => `## ${r.name}\n${r.ok ? r.text : `(no reply: ${r.text})`}`).join("\n\n");
						return {
							content: [{ type: "text", text }],
							details: { results: results.map((r) => ({ name: r.name, ok: r.ok, ms: r.ms })) },
						};
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "get_dot_updates",
					label: "Dot updates",
					description:
						"Instant (no model call): recent events and updates from your Dots. Use first for 'what's new / anything important' questions.",
					parameters: Type.Object({
						dot: Type.Optional(Type.String({ description: "Dot name; omit for all Dots" })),
						since: Type.Optional(Type.String({ description: "ISO time, 'today', '1h', '24h'" })),
						limit: Type.Optional(Type.Number({ maximum: 50 })),
					}),
					annotations: { readOnlyHint: true },
					async execute(_id, p) {
						const text = await deps.updates(p.dot, parseSince(p.since), Math.min(p.limit ?? 20, 50));
						return { content: [{ type: "text", text }], details: undefined };
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "search_dot_history",
					label: "Search Dot history",
					description:
						"Local text search over a Dot's chat history (no model call). Returns matching snippets with times.",
					parameters: Type.Object({
						dot: Type.String(),
						query: Type.String(),
						limit: Type.Optional(Type.Number({ maximum: 20 })),
					}),
					annotations: { readOnlyHint: true },
					async execute(_id, p) {
						const text = await deps.searchHistory(p.dot, p.query, Math.min(p.limit ?? 10, 20));
						return { content: [{ type: "text", text }], details: undefined };
					},
				}),
			);
		},
	};
}
