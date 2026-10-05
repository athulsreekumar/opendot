// One-click OAuth sign-in for remote MCP servers, via pi's own `/mcp login` in a throwaway session (spec 05 §3.2).
// pi stores the tokens in ~/.opendot/pi/mcp-auth.json, where every Dot's MCP extension finds them.
import type { Connection } from "../../shared/types";
import type { ModelService } from "../models/model-service";
import type { Paths } from "../paths";
import {
	createAgentSession,
	createMcpExtension,
	DefaultResourceLoader,
	type LoadedMcpConfig,
	type McpServerConfig,
	SessionManager,
	SettingsManager,
} from "../runtime/pi-adapter";

export async function signInMcpServer(
	conn: Connection,
	config: McpServerConfig,
	deps: { paths: Paths; models: ModelService; openUrl: (u: string) => void; timeoutMs?: number },
): Promise<{ ok: boolean; message: string }> {
	const notes: Array<{ msg: string; level: string }> = [];
	const settingsManager = SettingsManager.inMemory({} as never);
	const loader = new DefaultResourceLoader({
		cwd: deps.paths.root,
		agentDir: deps.paths.piDir,
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		systemPrompt: "Sign-in helper.",
		extensionFactories: [
			{
				name: "opendot-mcp-signin",
				hidden: true,
				factory: createMcpExtension({
					loadConfig: () =>
						({
							servers: [{ name: conn.name, config, source: "opendot", scope: "global" }],
							autoEnableCodemode: false,
							errors: [],
						}) as unknown as LoadedMcpConfig,
					logPath: `${deps.paths.piDir}/mcp.log`,
					openUrl: deps.openUrl,
					updateConfig: () => undefined,
				}),
			},
		],
	});
	await loader.reload();
	let model: Awaited<ReturnType<ModelService["resolveModel"]>> | undefined;
	try {
		model = await deps.models.resolveModel();
	} catch {
		model = undefined;
	}
	const { session } = await createAgentSession({
		cwd: deps.paths.root,
		agentDir: deps.paths.piDir,
		modelRuntime: deps.models.runtime,
		...(model ? { model } : {}),
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(deps.paths.root),
		settingsManager,
		noTools: "all",
	});
	const abort = new AbortController();
	// Minimal UI context: pi only needs notify + input for the non-TUI sign-in path.
	const ui = new Proxy(
		{
			notify: (msg: string, level: string) => notes.push({ msg, level }),
			input: (_t: string, _p: string, opts?: { signal?: AbortSignal }) =>
				new Promise<string | undefined>((resolve) => {
					const s = opts?.signal ?? abort.signal;
					s.addEventListener("abort", () => resolve(undefined), { once: true });
				}),
			confirm: async () => false,
			select: async () => undefined,
			setStatus: () => undefined,
		} as Record<string, unknown>,
		{ get: (t, k) => (k in t ? t[k as string] : () => undefined) },
	);
	try {
		await session.bindExtensions({ mode: "rpc", uiContext: ui } as never);
		const run = session.prompt(`/mcp login ${conn.name}`);
		const timeout = new Promise<never>((_r, rej) =>
			setTimeout(() => rej(new Error("Sign-in timed out (5 min).")), deps.timeoutMs ?? 300_000),
		);
		await Promise.race([run, timeout]);
		const err = notes.find((n) => n.level === "error");
		if (err) return { ok: false, message: err.msg };
		const ok = notes.find((n) => /Signed in/i.test(n.msg));
		return ok ? { ok: true, message: ok.msg } : { ok: false, message: notes.at(-1)?.msg ?? "Sign-in didn't complete." };
	} catch (e) {
		return { ok: false, message: (e as Error).message };
	} finally {
		abort.abort();
		session.dispose();
	}
}
