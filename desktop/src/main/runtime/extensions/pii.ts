// PII boundary (spec 06 §5.5): transcript keeps real values; only provider requests carry tokens.
import type { DotId } from "../../../shared/types";
import type { PiiService } from "../../pii/pii-service";
import type { InlineExtension } from "../pi-adapter";

type Block = { type: string; text?: string; thinking?: string; arguments?: Record<string, unknown> };
type Msg = { role: string; content?: unknown };

async function mapContent(content: unknown, f: (s: string) => Promise<string>): Promise<unknown> {
	if (typeof content === "string") return f(content);
	if (!Array.isArray(content)) return content;
	const out: unknown[] = [];
	for (const b of content as Block[]) {
		if (b.type === "text" && typeof b.text === "string") out.push({ ...b, text: await f(b.text) });
		else if (b.type === "thinking" && typeof b.thinking === "string") out.push({ ...b, thinking: await f(b.thinking) });
		else if (b.type === "toolCall" && b.arguments) out.push({ ...b, arguments: await mapDeep(b.arguments, f) });
		else out.push(b);
	}
	return out;
}

async function mapDeep<T>(v: T, f: (s: string) => Promise<string>): Promise<T> {
	if (typeof v === "string") return (await f(v)) as T;
	if (Array.isArray(v)) return (await Promise.all(v.map((x) => mapDeep(x, f)))) as T;
	if (v && typeof v === "object") {
		const o: Record<string, unknown> = {};
		for (const [k, x] of Object.entries(v)) o[k] = await mapDeep(x, f);
		return o as T;
	}
	return v;
}

export function piiExtension(
	pii: PiiService,
	dotId: DotId,
	onRedacted?: (count: number, types: string[]) => void,
): InlineExtension {
	return {
		name: "opendot-pii",
		hidden: true,
		factory: (api) => {
			api.on("context", async (event) => {
				if (!(await pii.shouldRedact(dotId))) return;
				let count = 0;
				const types = new Set<string>();
				const f = async (s: string) => {
					const r = await pii.redact(dotId, s);
					count += r.spans.length;
					for (const sp of r.spans) types.add(sp.type);
					return r.text;
				};
				const messages = [];
				for (const m of event.messages as Msg[]) {
					if (m.role === "user" || m.role === "assistant" || m.role === "toolResult" || m.role === "custom") {
						messages.push({ ...m, content: await mapContent(m.content, f) });
					} else messages.push(m);
				}
				if (count) onRedacted?.(count, [...types]);
				return { messages: messages as typeof event.messages };
			});
			api.on("tool_call", (event) => {
				pii.restoreInPlace(dotId, event.input as Record<string, unknown>);
			});
			api.on("message_end", (event) => {
				const m = event.message as Msg;
				if (m.role !== "assistant" || !Array.isArray(m.content)) return;
				const content = (m.content as Block[]).map((b) =>
					b.type === "text" && b.text ? { ...b, text: pii.restore(dotId, b.text) } : b,
				);
				return { message: { ...(event.message as object), content } as typeof event.message };
			});
		},
	};
}
