// Lists the tools a built-in connection (This Mac, Google, Microsoft) provides, for the Connections screen.
// The factories only build definitions; nothing here runs a tool, so the deps are inert stubs.
import { platformFeatures } from "../../shared/platform";
import type { Connection, ConnectionToolInfo } from "../../shared/types";
import type { ToolDefinition } from "../runtime/pi-adapter";
import { googleTools } from "./google";
import { macTools } from "./mac";
import { microsoftTools } from "./microsoft";
import { shellAvailable } from "./shell-support";

const GOOGLE_ALL = ["gmail", "calendar", "drive"];
const MICROSOFT_ALL = ["mail", "calendar", "onedrive", "teams"];

/** pi's file and shell tools, granted through the This Mac / This PC connection's "files" and "shell" features. */
const MAC_BUILTINS: Array<{ feature: string; name: string; description: string; readOnly: boolean }> = [
	{
		feature: "files",
		name: "read",
		description: "Read a file in the Dot's workspace or a folder you allowed.",
		readOnly: true,
	},
	{ feature: "files", name: "ls", description: "List the files in a folder.", readOnly: true },
	{ feature: "files", name: "find", description: "Find files by name.", readOnly: true },
	{ feature: "files", name: "grep", description: "Search inside files.", readOnly: true },
	{ feature: "files", name: "write", description: "Create or overwrite a file.", readOnly: false },
	{ feature: "files", name: "edit", description: "Make precise edits to a file.", readOnly: false },
	{ feature: "shell", name: "bash", description: "Run a shell command in the Dot's workspace.", readOnly: false },
];

/** Deps that fail loudly if a tool were ever executed through them (it never is). */
const inert = new Proxy(
	{},
	{
		get: () => () => Promise.reject(new Error("Tool listing only: not executable.")),
	},
) as never;

function describe(defs: ToolDefinition[], c: Connection): ConnectionToolInfo[] {
	return defs.map((t) => {
		const a = (t as { annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }).annotations ?? {};
		return {
			name: t.name,
			description: (t.description ?? "").split("\n")[0]!.slice(0, 200),
			exposure: c.toolExposure[t.name] ?? c.exposure,
			readOnly: a.readOnlyHint === true,
			destructive: a.destructiveHint === true,
		};
	});
}

/** The tools a built-in connection offers with its current features. Empty for MCP connections. */
export function nativeToolCatalog(
	c: Connection,
	platform: string = process.platform,
	shellOk: boolean = shellAvailable(platform),
): ConnectionToolInfo[] {
	if (c.type === "mac") {
		const feats = platformFeatures(c.features ?? [], platform);
		const builtins: ConnectionToolInfo[] = MAC_BUILTINS.filter(
			(b) => feats.includes(b.feature) && (b.name !== "bash" || shellOk),
		).map((b) => ({
			name: b.name,
			description: b.description,
			exposure: c.toolExposure[b.name] ?? c.exposure,
			readOnly: b.readOnly,
			destructive: b.name === "bash" || b.name === "write",
		}));
		return [...builtins, ...describe(macTools(feats, inert, platform), c)];
	}
	if (c.type === "google") return describe(googleTools(c.features?.length ? c.features : GOOGLE_ALL, inert), c);
	if (c.type === "microsoft")
		return describe(microsoftTools(c.features?.length ? c.features : MICROSOFT_ALL, inert), c);
	return [];
}
