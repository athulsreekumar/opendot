import { homedir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import { ConnectionService } from "/Users/athulsreekumar/Documents/opendot/desktop/src/main/connections/connection-service";
import { createPaths, ensureBaseDirs } from "/Users/athulsreekumar/Documents/opendot/desktop/src/main/paths";
import { SecretStore } from "/Users/athulsreekumar/Documents/opendot/desktop/src/main/security/secret-store";
import { Store } from "/Users/athulsreekumar/Documents/opendot/desktop/src/main/store/store";

it("checks the real cloudflare connection", async () => {
	const paths = createPaths(
		"/private/tmp/claude-501/-Users-athulsreekumar-Documents-opendot/6f4a7f76-6782-4377-b6c5-26371ba4fa34/scratchpad/e2e",
	);
	ensureBaseDirs(paths);
	const safe = {
		isEncryptionAvailable: () => true,
		encryptString: (s: string) => Buffer.from(s),
		decryptString: (b: Buffer) => b.toString(),
	};
	const svc = new ConnectionService(
		new Store(paths),
		await SecretStore.create(
			join(
				"/private/tmp/claude-501/-Users-athulsreekumar-Documents-opendot/6f4a7f76-6782-4377-b6c5-26371ba4fa34/scratchpad/e2e",
				"s.bin",
			),
			safe,
		),
		{ status: () => {}, changed: () => {} },
		() => {},
	);
	svc.mcpAuthFile = join(homedir(), ".opendot/pi/mcp-auth.json");
	for (const c of (await svc.list()).filter((x) => x.type === "mcp-http")) {
		const st = await svc.check(c.id);
		console.log(
			c.name,
			"=>",
			st.state,
			st.toolCount,
			"tools",
			st.error ?? "",
			st.tools
				.map((t) => t.name)
				.slice(0, 5)
				.join(","),
		);
	}
}, 120000);
