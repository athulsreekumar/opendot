import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { textResult } from "./jxa";

export function notifyTools(deps: MacDeps): ToolDefinition[] {
	const notify = defineTool({
		name: "mac_notify",
		label: "Notify",
		description: "Show a macOS notification.",
		parameters: Type.Object({ title: Type.String(), body: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		async execute(_id, p) {
			deps.notify(p.title, p.body);
			return textResult("Notification shown.");
		},
	});
	return [notify] as unknown as ToolDefinition[];
}
