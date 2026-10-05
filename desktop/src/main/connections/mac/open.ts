import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { textResult } from "./jxa";

export function openTools(deps: MacDeps): ToolDefinition[] {
	const url = defineTool({
		name: "mac_open_url",
		label: "Open URL",
		description: "Open an https URL in the default browser.",
		parameters: Type.Object({ url: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		async execute(_id, p) {
			let u: URL;
			try {
				u = new URL(p.url);
			} catch {
				throw new Error("Invalid URL");
			}
			if (u.protocol !== "https:") throw new Error("Only https URLs can be opened");
			await deps.openUrl(u.toString());
			return textResult(`Opened ${u.toString()}`);
		},
	});
	const app = defineTool({
		name: "mac_open_app",
		label: "Open app",
		description: "Launch a macOS application by name.",
		parameters: Type.Object({ name: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		async execute(_id, p) {
			if (!p.name.trim() || p.name.startsWith("-")) throw new Error("Invalid app name");
			await deps.openApp(p.name);
			return textResult(`Opened ${p.name}`);
		},
	});
	return [url, app] as unknown as ToolDefinition[];
}
