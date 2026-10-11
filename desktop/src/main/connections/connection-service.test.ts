import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { secretRefs } from "../../shared/secrets";
import { createPaths, ensureBaseDirs } from "../paths";
import { SecretStore } from "../security/secret-store";
import { Store } from "../store/store";
import { ConnectionService, cleanSecret, savedMcpToken } from "./connection-service";

const fakeSafe = {
	isEncryptionAvailable: () => true,
	encryptString: (s: string) => Buffer.from(s),
	decryptString: (b: Buffer) => b.toString(),
};

async function setup() {
	const root = mkdtempSync(join(tmpdir(), "od-conns-"));
	const paths = createPaths(root);
	ensureBaseDirs(paths);
	const secrets = await SecretStore.create(paths.secrets, fakeSafe);
	const svc = new ConnectionService(new Store(paths), secrets, { status: () => {}, changed: () => {} }, () => {});
	return { svc, secrets };
}

describe("cleanSecret", () => {
	it("trims whitespace and newlines", () => {
		expect(cleanSecret("  ghp_abc\n")).toBe("ghp_abc");
	});

	it("drops a pasted Bearer prefix when the header already adds one", () => {
		expect(cleanSecret("Bearer ghp_abc", `Bearer \${secret:GITHUB_TOKEN}`)).toBe("ghp_abc");
		expect(cleanSecret("bearer   ghp_abc ", `Bearer \${secret:GITHUB_TOKEN}`)).toBe("ghp_abc");
	});

	it("keeps a Bearer prefix when the header is the whole secret", () => {
		expect(cleanSecret("Bearer abc", `\${secret:AUTHORIZATION}`)).toBe("Bearer abc");
	});
});

describe("secretRefs", () => {
	it("lists the keys referenced by headers and env", () => {
		expect(
			secretRefs({
				http: { url: "https://x", headers: { Authorization: `Bearer \${secret:GITHUB_TOKEN}`, "X-Plain": "1" } },
			}),
		).toEqual(["GITHUB_TOKEN"]);
		expect(
			secretRefs({ stdio: { command: "uvx", args: [], env: { DATABASE_URI: `\${secret:DATABASE_URI}` } } }),
		).toEqual(["DATABASE_URI"]);
	});
});

describe("ConnectionService secrets", () => {
	it("stores a cleaned token on install", async () => {
		const { svc, secrets } = await setup();
		const c = await svc.install({ catalogId: "github", inputs: { GITHUB_TOKEN: " Bearer ghp_abc\n" } });
		expect(await secrets.get(`conn:${c.id}:GITHUB_TOKEN`)).toBe("ghp_abc");
		const cfg = (await svc.mcpConfig(c)) as unknown as { headers: Record<string, string> };
		expect(cfg.headers.Authorization).toBe("Bearer ghp_abc");
	});

	it("asks for a missing token instead of sending an empty header", async () => {
		const { svc } = await setup();
		const c = await svc.install({ catalogId: "github", inputs: { GITHUB_TOKEN: "" } });
		expect(await svc.missingSecrets(c)).toEqual(["GITHUB_TOKEN"]);
		const cfg = (await svc.mcpConfig(c)) as unknown as { headers: Record<string, string> };
		expect(cfg.headers.Authorization).toBeUndefined();
		const st = await svc.check(c.id);
		expect(st.state).toBe("needs-auth");
		expect(st.error).toContain("GitHub Personal Access Token");
	});

	it("replaces a token through update and ignores empty values", async () => {
		const { svc, secrets } = await setup();
		const c = await svc.install({ catalogId: "github", inputs: { GITHUB_TOKEN: "old" } });
		await svc.update(c.id, { secrets: { GITHUB_TOKEN: "Bearer new " } });
		expect(await secrets.get(`conn:${c.id}:GITHUB_TOKEN`)).toBe("new");
		await svc.update(c.id, { secrets: { GITHUB_TOKEN: "  " } });
		expect(await secrets.get(`conn:${c.id}:GITHUB_TOKEN`)).toBe("new");
		expect(await svc.missingSecrets(c)).toEqual([]);
	});
});

describe("savedMcpToken", () => {
	const url = "https://mcp.example.com/mcp";
	const file = (states: unknown) => {
		const f = join(mkdtempSync(join(tmpdir(), "od-mcpauth-")), "mcp-auth.json");
		writeFileSync(f, JSON.stringify(states));
		return f;
	};

	it("reads the token pi saved under the server name and URL", async () => {
		const f = file({
			[`mcp__my_server|${url}`]: { tokens: { access_token: "tok" }, tokensExpireAt: Date.now() + 60_000 },
		});
		expect(await savedMcpToken(f, "my-server", url)).toBe("tok");
	});

	it("falls back to the legacy URL-only key", async () => {
		expect(await savedMcpToken(file({ [url]: { tokens: { access_token: "old" } } }), "x", url)).toBe("old");
	});

	it("treats expired, pending or missing sign-ins as no token", async () => {
		const f = file({
			[`mcp__a|${url}`]: { tokens: { access_token: "tok" }, tokensExpireAt: Date.now() - 1 },
			[`mcp__b|${url}`]: { oauthState: "pending" },
		});
		expect(await savedMcpToken(f, "a", url)).toBeUndefined();
		expect(await savedMcpToken(f, "b", url)).toBeUndefined();
		expect(await savedMcpToken(f, "c", url)).toBeUndefined();
		expect(await savedMcpToken(join(tmpdir(), "does-not-exist.json"), "a", url)).toBeUndefined();
	});
});
