// OAuth token persistence + refresh. Tokens live only in SecretStore under `oauth:<connId>`. Spec 05 §4.
import type { OAuthProviderConfig, OAuthTokens } from "../connections/native-types";
import { NeedsAuthError } from "../watchers/types";
import { refreshTokens, TokenEndpointError } from "./loopback";

export interface SecretLike {
	get(k: string): Promise<string | undefined>;
	set(k: string, v: string): Promise<void>;
	delete(k: string): Promise<void>;
}

const REFRESH_MARGIN_MS = 120_000;

export class OAuthTokenStore {
	private inflight = new Map<string, Promise<OAuthTokens>>();

	constructor(
		private secrets: SecretLike,
		private fetchImpl: typeof fetch = fetch,
	) {}

	private key(connId: string): string {
		return `oauth:${connId}`;
	}

	async save(connId: string, tokens: OAuthTokens): Promise<void> {
		await this.secrets.set(this.key(connId), JSON.stringify(tokens));
	}

	async load(connId: string): Promise<OAuthTokens | undefined> {
		const raw = await this.secrets.get(this.key(connId));
		if (!raw) return undefined;
		try {
			return JSON.parse(raw) as OAuthTokens;
		} catch {
			return undefined;
		}
	}

	async clear(connId: string): Promise<void> {
		await this.secrets.delete(this.key(connId));
	}

	async getAccessToken(connId: string, cfg: OAuthProviderConfig): Promise<string> {
		const tokens = await this.load(connId);
		if (!tokens) throw new NeedsAuthError();
		if (tokens.expires_at - Date.now() > REFRESH_MARGIN_MS) return tokens.access_token;
		if (!tokens.refresh_token) throw new NeedsAuthError("Session expired, sign in again");
		let p = this.inflight.get(connId);
		if (!p) {
			const refreshToken = tokens.refresh_token;
			p = (async () => {
				try {
					const fresh = await refreshTokens(cfg, refreshToken, this.fetchImpl);
					await this.save(connId, fresh);
					return fresh;
				} catch (e) {
					if (e instanceof TokenEndpointError && (e.status === 400 || e.status === 401)) {
						throw new NeedsAuthError("Session expired, sign in again");
					}
					throw e;
				}
			})().finally(() => this.inflight.delete(connId));
			this.inflight.set(connId, p);
		}
		return (await p).access_token;
	}
}
