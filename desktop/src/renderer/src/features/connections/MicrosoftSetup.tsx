import type { Connection } from "@shared/types";
import { ExternalLinkButton, type OAuthProviderSpec, OAuthSetupDialog } from "./OAuthSetup";

export const MICROSOFT_SPEC: OAuthProviderSpec = {
	type: "microsoft",
	brand: "Microsoft",
	needsSecret: false,
	features: [
		{ id: "mail", label: "Mail" },
		{ id: "calendar", label: "Calendar" },
		{ id: "onedrive", label: "OneDrive" },
		{ id: "teams", label: "Teams" },
	],
	steps: [
		<span key="1">
			Open <ExternalLinkButton url="https://entra.microsoft.com">entra.microsoft.com</ExternalLinkButton> → App
			registrations → New registration.
		</span>,
		<span key="2">
			Supported accounts: "Accounts in any organizational directory and personal Microsoft accounts".
		</span>,
		<span key="3">
			Redirect URI: platform "Public client/native (mobile &amp; desktop)", value{" "}
			<code className="font-mono text-xs">http://localhost</code>.
		</span>,
		<span key="4">Authentication → "Allow public client flows" = Yes.</span>,
		<span key="5">Copy the Application (client) ID into OpenDot.</span>,
	],
};

export function MicrosoftSetup(props: { open: boolean; onOpenChange: (o: boolean) => void; connection?: Connection }) {
	return <OAuthSetupDialog spec={MICROSOFT_SPEC} {...props} />;
}
