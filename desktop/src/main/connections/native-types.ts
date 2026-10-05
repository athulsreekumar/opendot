// Contract for native connector tool sets (Google, Microsoft, macOS). Spec 05 §5–§6.
import type { ToolDefinition } from "../runtime/pi-adapter";

export interface NativeToolDeps {
	fetch: typeof fetch;
	/** Fresh OAuth access token for this connection (refreshes as needed). */
	getAccessToken(): Promise<string>;
	/** Run JXA (osascript -l JavaScript -e script). Mac only. */
	runJxa(script: string, timeoutMs?: number): Promise<string>;
	now(): Date;
}

/** Build the tools for the enabled features. Every tool must set `annotations` (readOnlyHint / destructiveHint / openWorldHint). */
export type NativeToolFactory = (features: string[], deps: NativeToolDeps) => ToolDefinition[];

export interface OAuthProviderConfig {
	id: "google" | "microsoft";
	authorizeUrl: string;
	tokenUrl: string;
	clientId: string;
	clientSecret?: string;
	scopes: string[];
	extraAuthParams?: Record<string, string>;
}

export interface OAuthTokens {
	access_token: string;
	refresh_token?: string;
	/** epoch ms */
	expires_at: number;
	scope?: string;
}
