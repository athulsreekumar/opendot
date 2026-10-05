// Loopback + PKCE authorization-code flow for native connectors. Spec 05 §4.
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { OAuthProviderConfig, OAuthTokens } from "../connections/native-types";
import { challengeS256, createVerifier, randomState } from "./pkce";

export interface LoopbackOptions {
	openUrl(url: string): void | Promise<void>;
	timeoutMs?: number;
	fetch?: typeof fetch;
	signal?: AbortSignal;
}

const DONE_HTML =
	'<!doctype html><html><head><meta charset="utf-8"><title>OpenDot</title></head><body style="font-family:system-ui;text-align:center;margin-top:20vh"><h2>You can close this tab ✓</h2></body></html>';

interface TokenResponse {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	scope?: string;
	error?: string;
	error_description?: string;
}

export class TokenEndpointError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
		this.name = "TokenEndpointError";
	}
}

async function postToken(
	cfg: OAuthProviderConfig,
	params: Record<string, string>,
	fetchImpl: typeof fetch,
): Promise<TokenResponse> {
	const body = new URLSearchParams({ client_id: cfg.clientId, ...params });
	if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);
	const res = await fetchImpl(cfg.tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
		body: body.toString(),
	});
	let json: TokenResponse = {};
	try {
		json = (await res.json()) as TokenResponse;
	} catch {
		// non-JSON body
	}
	if (!res.ok || !json.access_token) {
		throw new TokenEndpointError(
			res.status,
			`Token request failed (${res.status}): ${json.error_description ?? json.error ?? "unknown error"}`,
		);
	}
	return json;
}

function toTokens(json: TokenResponse, fallbackRefresh?: string): OAuthTokens {
	const tokens: OAuthTokens = {
		access_token: json.access_token ?? "",
		expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
	};
	const refresh = json.refresh_token ?? fallbackRefresh;
	if (refresh) tokens.refresh_token = refresh;
	if (json.scope) tokens.scope = json.scope;
	return tokens;
}

export async function refreshTokens(
	cfg: OAuthProviderConfig,
	refreshToken: string,
	fetchImpl: typeof fetch = fetch,
): Promise<OAuthTokens> {
	const json = await postToken(cfg, { grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
	return toTokens(json, refreshToken);
}

export async function runLoopbackFlow(cfg: OAuthProviderConfig, opts: LoopbackOptions): Promise<OAuthTokens> {
	const fetchImpl = opts.fetch ?? fetch;
	const timeoutMs = opts.timeoutMs ?? 5 * 60_000;
	const verifier = createVerifier();
	const state = randomState();

	const server = http.createServer();
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolve());
	});
	const port = (server.address() as AddressInfo).port;
	const redirectUri = `http://127.0.0.1:${port}/callback`;

	const code = await new Promise<string>((resolve, reject) => {
		let settled = false;
		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			opts.signal?.removeEventListener("abort", onAbort);
			fn();
		};
		const timer = setTimeout(() => finish(() => reject(new Error("Sign-in timed out"))), timeoutMs);
		const onAbort = () => finish(() => reject(new Error("Sign-in cancelled")));
		if (opts.signal?.aborted) onAbort();
		else opts.signal?.addEventListener("abort", onAbort);

		server.on("request", (req, res) => {
			const url = new URL(req.url ?? "/", redirectUri);
			if (url.pathname !== "/callback") {
				res.writeHead(404).end();
				return;
			}
			if (url.searchParams.get("state") !== state) {
				res.writeHead(400, { "Content-Type": "text/plain" }).end("State mismatch");
				finish(() => reject(new Error("OAuth state mismatch")));
				return;
			}
			const err = url.searchParams.get("error");
			const got = url.searchParams.get("code");
			if (err || !got) {
				res.writeHead(400, { "Content-Type": "text/plain" }).end("Sign-in failed");
				finish(() => reject(new Error(`Sign-in failed: ${err ?? "no code returned"}`)));
				return;
			}
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(DONE_HTML);
			finish(() => resolve(got));
		});

		const authUrl = new URL(cfg.authorizeUrl);
		authUrl.searchParams.set("client_id", cfg.clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("response_type", "code");
		authUrl.searchParams.set("scope", cfg.scopes.join(" "));
		authUrl.searchParams.set("state", state);
		authUrl.searchParams.set("code_challenge", challengeS256(verifier));
		authUrl.searchParams.set("code_challenge_method", "S256");
		for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {})) authUrl.searchParams.set(k, v);
		Promise.resolve(opts.openUrl(authUrl.toString())).catch((e) =>
			finish(() => reject(e instanceof Error ? e : new Error(String(e)))),
		);
	}).finally(() => {
		server.close();
		server.closeAllConnections?.();
	});

	const json = await postToken(
		cfg,
		{ code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirectUri },
		fetchImpl,
	);
	return toTokens(json);
}
