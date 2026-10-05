// Microsoft 365 OAuth config + account lookup (spec 05 §5.2). Public client: PKCE, no secret.
import type { OAuthProviderConfig } from "../native-types";

const FEATURE_SCOPES: Record<string, string[]> = {
	mail: ["Mail.ReadWrite", "Mail.Send"],
	calendar: ["Calendars.ReadWrite"],
	onedrive: ["Files.ReadWrite"],
	teams: ["Chat.ReadWrite"],
};

export function microsoftOAuthConfig(clientId: string, features: string[]): OAuthProviderConfig {
	const scopes = ["offline_access", "User.Read"];
	for (const f of features) {
		for (const s of FEATURE_SCOPES[f] ?? []) if (!scopes.includes(s)) scopes.push(s);
	}
	return {
		id: "microsoft",
		authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
		tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
		clientId,
		scopes,
	};
}

/** Account email from GET /me → mail ?? userPrincipalName. */
export async function fetchMicrosoftAccount(token: string, fetchFn: typeof fetch): Promise<string> {
	const res = await fetchFn("https://graph.microsoft.com/v1.0/me", {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Microsoft Graph error ${res.status}: could not read the account profile`);
	const me = (await res.json()) as { mail?: string | null; userPrincipalName?: string | null };
	const email = me.mail ?? me.userPrincipalName;
	if (!email) throw new Error("Microsoft Graph returned no email for this account");
	return email;
}
