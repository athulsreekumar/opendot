import type { Connection } from "@shared/types";
import { ExternalLinkButton, type OAuthProviderSpec, OAuthSetupDialog } from "./OAuthSetup";

export const GOOGLE_SPEC: OAuthProviderSpec = {
	type: "google",
	brand: "Google",
	needsSecret: true,
	features: [
		{ id: "gmail", label: "Gmail" },
		{ id: "calendar", label: "Calendar" },
		{ id: "drive", label: "Drive" },
	],
	steps: [
		<span key="1">
			Open <ExternalLinkButton url="https://console.cloud.google.com/">console.cloud.google.com</ExternalLinkButton> and
			create a project.
		</span>,
		<span key="2">
			In "APIs &amp; Services → Library", enable Gmail API, Google Calendar API and Google Drive API.
		</span>,
		<span key="3">In "OAuth consent screen", choose External and add yourself as a test user.</span>,
		<span key="4">In "Credentials → Create credentials → OAuth client ID", choose Desktop app.</span>,
		<span key="5">Copy the Client ID and Client secret into OpenDot.</span>,
	],
};

export function GoogleSetup(props: { open: boolean; onOpenChange: (o: boolean) => void; connection?: Connection }) {
	return <OAuthSetupDialog spec={GOOGLE_SPEC} {...props} />;
}
