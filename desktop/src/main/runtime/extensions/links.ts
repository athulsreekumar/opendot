// list_dots / message_dot (spec 07 §5).
import type { Dot, DotId } from "../../../shared/types";
import type { LinkBus } from "../../links/link-bus";
import { defineTool, type InlineExtension, Type } from "../pi-adapter";

export interface LinksExtDeps {
	bus: LinkBus;
	getDot: () => Promise<Dot>;
	chain: () => DotId[];
	emitPeer: (
		toolCallId: string,
		peer: DotId,
		status: "queued" | "running" | "done" | "error" | "blocked",
		patch?: { delta?: string; text?: string; error?: string },
	) => void;
}

export function linksExtension(deps: LinksExtDeps): InlineExtension {
	return {
		name: "opendot-links",
		hidden: true,
		factory: (api) => {
			api.registerTool(
				defineTool({
					name: "list_dots",
					label: "Dots · list",
					description: "List the other Dots (assistants) you may message right now, with what each one does.",
					parameters: Type.Object({}),
					annotations: { readOnlyHint: true },
					async execute() {
						const me = await deps.getDot();
						const list = await deps.bus.reachableFrom(me);
						const text = list.length
							? list
									.map(
										(r) =>
											`- ${r.dot.name} — ${r.dot.tagline || r.dot.persona.role.slice(0, 120)}${r.approval === "ask" ? " (the user approves each message)" : ""}${r.purpose ? ` · purpose: ${r.purpose}` : ""}`,
									)
									.join("\n")
							: "You can't message any Dots. The user can allow this in Dot Links.";
						return { content: [{ type: "text", text }], details: undefined };
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "message_dot",
					label: "Message a Dot",
					description:
						"Send a message to another Dot and wait for its reply. Use list_dots first. Only works where the user has allowed it.",
					parameters: Type.Object({
						to: Type.String({ description: "Dot name or id from list_dots" }),
						message: Type.String({
							description: "Self-contained request. The other Dot cannot see this conversation.",
						}),
					}),
					annotations: { openWorldHint: false, destructiveHint: false },
					executionMode: "sequential",
					async execute(toolCallId, p, signal) {
						const me = await deps.getDot();
						let acc = "";
						const r = await deps.bus.send(me, p.to, p.message, deps.chain(), {
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
						if (r.to)
							deps.emitPeer(
								toolCallId,
								r.to.id,
								r.ok ? "done" : "error",
								r.ok ? { text: r.reply } : { error: r.reason, text: acc },
							);
						if (!r.ok) throw new Error(r.reason);
						return { content: [{ type: "text", text: r.reply }], details: { to: r.to.id } };
					},
				}),
			);
		},
	};
}
