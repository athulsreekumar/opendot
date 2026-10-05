import type { ConnectorChoice } from "@shared/types";

/** Maps a template's suggested connection ids ("google:gmail", "fetch", "drive") to the available connector choices. */
export function mapSuggestedConnections(suggested: string[], choices: ConnectorChoice[]): ConnectorChoice[] {
	const out = new Map<string, ConnectorChoice>();
	for (const raw of suggested) {
		const s = raw.toLowerCase();
		const found =
			choices.find((c) => c.id.toLowerCase() === s) ??
			choices.find((c) => ["google", "microsoft", "mac"].some((p) => c.id.toLowerCase() === `${p}:${s}`)) ??
			choices.find((c) => c.id.toLowerCase().endsWith(`:${s}`)) ??
			choices.find((c) => c.label.toLowerCase().includes(s));
		if (found) out.set(found.id, found);
	}
	return [...out.values()];
}
