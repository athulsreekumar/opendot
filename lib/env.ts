/**
 * Typed, lazily-read server environment. Nothing is read at import time, so `next build` never needs secrets.
 * Never log the values returned here.
 */
export type ServerEnv = {
	resendApiKey?: string;
	resendAudienceId?: string;
	notifyTo?: string;
	from: string;
	confirmFrom?: string;
	upstashUrl?: string;
	upstashToken?: string;
	mock: boolean;
	siteUrl: string;
};

export const DEFAULT_FROM = "OpenDot <onboarding@resend.dev>";

function pick(source: Record<string, string | undefined>, key: string): string | undefined {
	const v = source[key]?.trim();
	return v ? v : undefined;
}

export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
	return {
		resendApiKey: pick(source, "RESEND_API_KEY"),
		resendAudienceId: pick(source, "RESEND_AUDIENCE_ID"),
		notifyTo: pick(source, "EARLY_ACCESS_NOTIFY_TO"),
		from: pick(source, "EARLY_ACCESS_FROM") ?? DEFAULT_FROM,
		confirmFrom: pick(source, "EARLY_ACCESS_CONFIRM_FROM"),
		upstashUrl: pick(source, "UPSTASH_REDIS_REST_URL"),
		upstashToken: pick(source, "UPSTASH_REDIS_REST_TOKEN"),
		mock: pick(source, "RESEND_MOCK") === "1",
		siteUrl: (pick(source, "SITE_URL") ?? "https://opendot.live").replace(/\/$/, ""),
	};
}
