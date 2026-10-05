import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pi spike", () => {
	it("runs a faux session with inline tools, sections and custom messages", async () => {
		const dir = mkdtempSync(join(tmpdir(), "od-spike-"));
		process.env.PI_CODING_AGENT_DIR = join(dir, "pi");
		process.env.PI_TELEMETRY = "0";
		process.env.PI_SKIP_VERSION_CHECK = "1";
		process.env.PI_OFFLINE = "1";
		const pi = await import("../../src/main/runtime/pi-adapter");
		const runtime = await pi.ModelRuntime.create({
			authPath: join(dir, "auth.json"),
			modelsPath: null as unknown as string,
		});
		const faux = pi.fauxProvider({
			provider: "opendot-fake",
			models: [{ id: "fake-1", name: "Fake" }],
			tokensPerSecond: 2000,
		});
		runtime.registerNativeProvider(faux.provider);
		const model = runtime.getModel("opendot-fake", "fake-1");
		expect(model).toBeTruthy();
		const captured: unknown[] = [];
		faux.setResponses([
			pi.fauxAssistantMessage([pi.fauxToolCall("hello_tool", { name: "x" })], { stopReason: "toolUse" }),
			(ctx) => {
				captured.push(ctx);
				return pi.fauxAssistantMessage("Done hello");
			},
			pi.fauxAssistantMessage("[UPDATE] event handled"),
		]);
		const helloTool = pi.defineTool({
			name: "hello_tool",
			label: "Hello",
			description: "say hello",
			parameters: pi.Type.Object({ name: pi.Type.String() }),
			async execute(_id, params) {
				return { content: [{ type: "text", text: `hi ${params.name}` }], details: undefined };
			},
		});
		const settingsManager = pi.SettingsManager.inMemory({ compaction: { enabled: false } });
		settingsManager.applyOverrides({ defaultTools: ["+codemode"] } as never);
		const loader = new pi.DefaultResourceLoader({
			cwd: dir,
			agentDir: join(dir, "pi"),
			settingsManager,
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
			systemPrompt: "You are a test dot.",
			extensionFactories: [
				{
					name: "t",
					factory: (api) => {
						api.registerTool(helloTool);
						api.on("before_agent_start", (ev) => {
							ev.systemPromptOptions.sections.now = "Today is test day";
						});
					},
				},
			],
		});
		await loader.reload();
		const { session } = await pi.createAgentSession({
			cwd: dir,
			agentDir: join(dir, "pi"),
			modelRuntime: runtime,
			model: model!,
			thinkingLevel: "off",
			resourceLoader: loader,
			sessionManager: pi.SessionManager.create(dir, join(dir, "sessions")),
			settingsManager,
			noTools: "builtin",
		});
		await session.bindExtensions({ mode: "rpc" });
		const types: string[] = [];
		let deltas = 0;
		session.subscribe((ev) => {
			types.push(ev.type);
			if (ev.type === "message_update" && ev.assistantMessageEvent.type === "text_delta") deltas++;
		});
		console.log("ACTIVE TOOLS", session.getActiveToolNames());
		await session.prompt("hi");
		expect(deltas).toBeGreaterThan(0);
		await session.sendCustomMessage(
			{ customType: "opendot.events", content: "event!", display: true, details: { ids: [1] } },
			{ triggerTurn: true, deliverAs: "followUp" },
		);
		await session.waitForIdle();
		const msgs = session.messages.map((m) => (m as { role: string }).role);
		console.log("ROLES", msgs, "SYSPROMPT", session.systemPrompt.slice(0, 300));
		console.log("EVENTS", [...new Set(types)].join(","));
		const entries = session.sessionManager.getBranch().map((e) => e.type);
		console.log("ENTRIES", entries.join(","));
		session.dispose();
	}, 30000);
});
