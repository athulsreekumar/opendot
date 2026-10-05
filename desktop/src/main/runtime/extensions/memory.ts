// remember / forget / recall tools (spec 02 §2.1).
import type { DotId } from "../../../shared/types";
import type { MemoryService } from "../../memory/memory-service";
import { defineTool, type InlineExtension, StringEnum, Type } from "../pi-adapter";

export function memoryExtension(memory: MemoryService, dotId: DotId): InlineExtension {
	return {
		name: "opendot-memory",
		hidden: true,
		factory: (api) => {
			api.registerTool(
				defineTool({
					name: "remember",
					label: "Memory · save",
					description:
						"Save a durable fact or preference to long-term memory. about='user' saves to the shared 'About me' memory all Dots see; about='dot' (default) saves to your own memory. Never save secrets or passwords.",
					parameters: Type.Object({
						text: Type.String({ description: "The fact, in one sentence." }),
						about: Type.Optional(StringEnum(["user", "dot"] as const)),
					}),
					annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
					async execute(_id, p) {
						const item = await memory.upsert(p.about === "user" ? "user" : dotId, { text: p.text }, "dot");
						return { content: [{ type: "text", text: `Saved (${item.id}).` }], details: undefined };
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "forget",
					label: "Memory · forget",
					description: "Delete a memory item by its id (shown in parentheses in your memory section).",
					parameters: Type.Object({ id: Type.String() }),
					annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
					async execute(_id, p) {
						const ok = (await memory.remove(dotId, p.id)) || (await memory.remove("user", p.id));
						if (!ok) throw new Error(`No memory item ${p.id}`);
						return { content: [{ type: "text", text: "Forgotten." }], details: undefined };
					},
				}),
			);
			api.registerTool(
				defineTool({
					name: "recall",
					label: "Memory · recall",
					description: "Search your memory and the user's 'About me' memory for items containing all the given words.",
					parameters: Type.Object({ query: Type.String() }),
					annotations: { readOnlyHint: true },
					async execute(_id, p) {
						const hits = await memory.search(dotId, p.query);
						const text = hits.length
							? hits.map((h) => `- (${h.id}) [${h.scope === "user" ? "about user" : "mine"}] ${h.text}`).join("\n")
							: "Nothing found.";
						return { content: [{ type: "text", text }], details: undefined };
					},
				}),
			);
		},
	};
}
