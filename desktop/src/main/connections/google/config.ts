// Google OAuth provider config + account lookup. Spec 05 §5.1.
import type { OAuthProviderConfig } from "../native-types";

const SCOPE_BASE = "https://www.googleapis.com/auth/";

export function googleOAuthConfig(clientId: string, clientSecret: string, features: string[]): OAuthProviderConfig {
	const scopes = ["openid", "email"];
	if (features.includes("gmail")) scopes.push(`${SCOPE_BASE}gmail.readonly`, `${SCOPE_BASE}gmail.compose`);
	if (features.includes("calendar")) scopes.push(`${SCOPE_BASE}calendar.events`);
	if (features.includes("drive")) scopes.push(`${SCOPE_BASE}drive.readonly`, `${SCOPE_BASE}drive.file`);
	const cfg: OAuthProviderConfig = {
		id: "google",
		authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		tokenUrl: "https://oauth2.googleapis.com/token",
		clientId,
		scopes,
		extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
	};
	if (clientSecret) cfg.clientSecret = clientSecret;
	return cfg;
}

export async function fetchGoogleAccount(token: string, fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
	const res = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) return undefined;
	const json = (await res.json()) as { email?: string };
	return json.email;
}
