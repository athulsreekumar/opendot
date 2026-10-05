import { describe, expect, it, vi } from "vitest";
import type { OAuthProviderConfig } from "../connections/native-types";
import { NeedsAuthError } from "../watchers/types";
import { refreshTokens, runLoopbackFlow } from "./loopback";
import { challengeS256, createVerifier, randomState } from "./pkce";
import { OAuthTokenStore, type SecretLike } from "./token-store";

const cfg: OAuthProviderConfig = {
	id: "google",
	authorizeUrl: "https://accounts.example.com/auth",
	tokenUrl: "https://oauth.example.com/token",
	clientId: "cid",
	clientSecret: "csecret",
	scopes: ["openid", "email"],
	extraAuthParams: { access_type: "offline" },
};

function memSecrets(): SecretLike & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		get: async (k) => map.get(k),
		set: async (k, v) => void map.set(k, v),
		delete: async (k) => void map.delete(k),
	};
}

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("pkce", () => {
	it("matches the RFC 7636 appendix B vector", () => {
		expect(challengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
			"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		);
	});
	it("creates url-safe random values", () => {
		const v = createVerifier();
		expect(v).toMatch(/^[A-Za-z0-9_-]{86}$/);
		expect(randomState()).not.toBe(randomState());
	});
});

describe("loopback flow", () => {
	it("completes end to end", async () => {
		let tokenBody = new URLSearchParams();
		const tokenFetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
			tokenBody = new URLSearchParams(String(init?.body));
			return json(200, { access_token: "AT", refresh_token: "RT", expires_in: 3600, scope: "openid" });
		}) as unknown as typeof fetch;
		let authUrl!: URL;
		const before = Date.now();
		const tokens = await runLoopbackFlow(cfg, {
			fetch: tokenFetch,
			openUrl: async (u) => {
				authUrl = new URL(u);
				const redirect = authUrl.searchParams.get("redirect_uri") ?? "";
				const res = await fetch(`${redirect}?code=thecode&state=${authUrl.searchParams.get("state")}`);
				expect(await res.text()).toContain("You can close this tab");
			},
		});
		expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
		expect(authUrl.searchParams.get("access_type")).toBe("offline");
		expect(authUrl.searchParams.get("redirect_uri")).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
		expect(tokenBody.get("code")).toBe("thecode");
		expect(tokenBody.get("grant_type")).toBe("authorization_code");
		expect(tokenBody.get("client_secret")).toBe("csecret");
		expect(challengeS256(tokenBody.get("code_verifier") ?? "")).toBe(authUrl.searchParams.get("code_challenge"));
		expect(tokens.access_token).toBe("AT");
		expect(tokens.refresh_token).toBe("RT");
		expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600_000);
	});

	it("rejects on state mismatch with a 400", async () => {
		let statusP: Promise<number> = Promise.resolve(0);
		const p = runLoopbackFlow(cfg, {
			fetch: vi.fn() as unknown as typeof fetch,
			openUrl: async (u) => {
				const redirect = new URL(u).searchParams.get("redirect_uri") ?? "";
				statusP = fetch(`${redirect}?code=x&state=wrong`).then((r) => r.status);
			},
		});
		await expect(p).rejects.toThrow(/state/i);
		expect(await statusP).toBe(400);
	});

	it("times out", async () => {
		await expect(runLoopbackFlow(cfg, { openUrl: () => undefined, timeoutMs: 50 })).rejects.toThrow(/timed out/);
	});
});

describe("refreshTokens", () => {
	it("keeps the old refresh token when none is returned", async () => {
		const f = vi.fn(async (_u: unknown, init?: RequestInit) => {
			expect(new URLSearchParams(String(init?.body)).get("grant_type")).toBe("refresh_token");
			return json(200, { access_token: "new", expires_in: 100 });
		}) as unknown as typeof fetch;
		const t = await refreshTokens(cfg, "old-rt", f);
		expect(t.access_token).toBe("new");
		expect(t.refresh_token).toBe("old-rt");
	});
});

describe("OAuthTokenStore", () => {
	it("returns a fresh token without refreshing", async () => {
		const f = vi.fn() as unknown as typeof fetch;
		const store = new OAuthTokenStore(memSecrets(), f);
		await store.save("c1", { access_token: "A", refresh_token: "R", expires_at: Date.now() + 600_000 });
		expect(await store.getAccessToken("c1", cfg)).toBe("A");
		expect(f).not.toHaveBeenCalled();
	});

	it("refreshes once (single-flight) when < 120 s remain and persists", async () => {
		const secrets = memSecrets();
		const f = vi.fn(async () => {
			await new Promise((r) => setTimeout(r, 10));
			return json(200, { access_token: "B", expires_in: 3600 });
		}) as unknown as typeof fetch;
		const store = new OAuthTokenStore(secrets, f);
		await store.save("c1", { access_token: "A", refresh_token: "R", expires_at: Date.now() + 60_000 });
		const [a, b] = await Promise.all([store.getAccessToken("c1", cfg), store.getAccessToken("c1", cfg)]);
		expect([a, b]).toEqual(["B", "B"]);
		expect(f).toHaveBeenCalledTimes(1);
		const saved = JSON.parse(secrets.map.get("oauth:c1") ?? "{}");
		expect(saved.access_token).toBe("B");
		expect(saved.refresh_token).toBe("R");
	});

	it("throws NeedsAuthError with no tokens or a rejected refresh", async () => {
		const f = vi.fn(async () => json(400, { error: "invalid_grant" })) as unknown as typeof fetch;
		const store = new OAuthTokenStore(memSecrets(), f);
		await expect(store.getAccessToken("none", cfg)).rejects.toBeInstanceOf(NeedsAuthError);
		await store.save("c1", { access_token: "A", refresh_token: "R", expires_at: 0 });
		await expect(store.getAccessToken("c1", cfg)).rejects.toBeInstanceOf(NeedsAuthError);
	});

	it("clear removes tokens", async () => {
		const store = new OAuthTokenStore(memSecrets());
		await store.save("c1", { access_token: "A", expires_at: 1 });
		await store.clear("c1");
		expect(await store.load("c1")).toBeUndefined();
	});
});
