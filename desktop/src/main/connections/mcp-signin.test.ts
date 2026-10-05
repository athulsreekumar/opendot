import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeSafeStorage } from "../../../test/unit/electron-mock";
import { ModelService } from "../models/model-service";
import { createPaths, ensureBaseDirs } from "../paths";
import { SecretStore } from "../security/secret-store";
import { SettingsService } from "../settings-service";
import { Store } from "../store/store";
import { signInMcpServer } from "./mcp-signin";

describe("signInMcpServer", () => {
	it("returns a readable failure (no hang) when the server can't do OAuth", async () => {
		const root = mkdtempSync(join(tmpdir(), "od-signin-"));
		const paths = createPaths(root);
		ensureBaseDirs(paths);
		process.env.PI_CODING_AGENT_DIR = paths.piDir;
		const server = createServer((_req, res) => {
			res.writeHead(404);
			res.end("nope");
		});
		await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
		const port = (server.address() as { port: number }).port;
		const store = new Store(paths);
		const settings = new SettingsService(store);
		const secrets = await SecretStore.create(paths.secrets, fakeSafeStorage);
		const models = await ModelService.create({ paths, settings, secrets });
		const opened: string[] = [];
		const r = await signInMcpServer(
			{
				id: "con_test00000001",
				type: "mcp-http",
				name: "remote",
				label: "Remote",
				description: "",
				icon: "globe",
				enabled: true,
				exposure: "deferred",
				toolExposure: {},
				features: [],
				createdAt: new Date().toISOString(),
				http: { url: `http://127.0.0.1:${port}/mcp`, headers: {} },
			},
			{ url: `http://127.0.0.1:${port}/mcp`, headers: {} } as never,
			{ paths, models, openUrl: (u) => opened.push(u), timeoutMs: 15000 },
		);
		server.close();
		expect(r.ok).toBe(false);
		expect(r.message.length).toBeGreaterThan(5);
		console.log("signin result:", r.message);
	}, 30000);
});
