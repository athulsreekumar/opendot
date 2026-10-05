import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";

export function screenTools(deps: MacDeps): ToolDefinition[] {
	const shot = defineTool({
		name: "mac_screenshot",
		label: "Screenshot",
		description: "Take a screenshot of the main display.",
		parameters: Type.Object({}),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute() {
			const s = await deps.screenshot();
			return {
				content: [
					{ type: "image" as const, data: s.base64Png, mimeType: "image/png" },
					{ type: "text" as const, text: `Screenshot ${s.width}x${s.height}` },
				],
				details: { width: s.width, height: s.height },
			};
		},
	});
	return [shot] as unknown as ToolDefinition[];
}
