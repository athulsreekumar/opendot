// Registers Google / Microsoft / Mac tools for a Dot's grants (spec 05 §5–§6).
import type { Connection } from "../../../shared/types";
import { googleTools } from "../../connections/google";
import { type MacDeps, macTools } from "../../connections/mac";
import { microsoftTools } from "../../connections/microsoft";
import type { NativeToolDeps } from "../../connections/native-types";
import type { InlineExtension, ToolDefinition } from "../pi-adapter";

export interface NativeToolsDeps {
	grants: Array<{ connection: Connection; features: string[] }>;
	base: Omit<NativeToolDeps, "getAccessToken">;
	accessToken: (type: "google" | "microsoft") => Promise<string>;
	mac: Omit<MacDeps, keyof NativeToolDeps>;
}

/** Tool name → owning connection type (used by the policy engine). */
export function nativeOwner(toolName: string): "google" | "microsoft" | "mac" | undefined {
	if (/^(gmail|calendar|drive)_/.test(toolName)) return "google";
	if (/^(outlook|onedrive|teams)_/.test(toolName)) return "microsoft";
	if (/^mac_/.test(toolName) || ["read", "write", "edit", "ls", "grep", "find", "bash"].includes(toolName))
		return "mac";
	return undefined;
}

export function nativeToolsExtension(deps: NativeToolsDeps): InlineExtension {
	return {
		name: "opendot-native-tools",
		hidden: true,
		factory: (api) => {
			const tools: ToolDefinition[] = [];
			for (const g of deps.grants) {
				const t = g.connection.type;
				if (t === "google")
					tools.push(...googleTools(g.features, { ...deps.base, getAccessToken: () => deps.accessToken("google") }));
				else if (t === "microsoft")
					tools.push(
						...microsoftTools(g.features, { ...deps.base, getAccessToken: () => deps.accessToken("microsoft") }),
					);
				else if (t === "mac") {
					tools.push(
						...macTools(g.features, {
							...deps.base,
							...deps.mac,
							getAccessToken: () => Promise.reject(new Error("not applicable")),
						} as MacDeps),
					);
				}
			}
			for (const tool of tools) api.registerTool(tool);
		},
	};
}
