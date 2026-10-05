import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { textResult } from "./jxa";

export function clipboardTools(deps: MacDeps): ToolDefinition[] {
	const read = defineTool({
		name: "mac_clipboard_read",
		label: "Read clipboard",
		description: "Read the current clipboard text.",
		parameters: Type.Object({}),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute() {
			return textResult(await deps.clipboardRead());
		},
	});
	const write = defineTool({
		name: "mac_clipboard_write",
		label: "Write clipboard",
		description: "Replace the clipboard text.",
		parameters: Type.Object({ text: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		async execute(_id, p) {
			deps.clipboardWrite(p.text);
			return textResult("Clipboard updated.");
		},
	});
	return [read, write] as unknown as ToolDefinition[];
}
