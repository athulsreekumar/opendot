import type {
	AlwaysOnSettings,
	AppSettings,
	BriefingSettings,
	DotProfile,
	Persona,
	PiiSettings,
	UiState,
} from "./types";

export function defaultPiiSettings(): PiiSettings {
	return {
		enabledTypes: ["EMAIL", "PHONE", "CARD", "IBAN", "SSN", "IP", "SECRET", "CUSTOM", "URL_CRED"],
		customTerms: [],
		detectNames: false,
	};
}

export function defaultBriefing(): BriefingSettings {
	return { enabled: false, time: "08:00", days: "weekdays", dots: {}, instructions: "" };
}

/** Briefing settings with defaults filled in (old settings files have none). */
export function resolveBriefing(s: Pick<AppSettings, "briefing"> | undefined): BriefingSettings {
	return { ...defaultBriefing(), ...(s?.briefing ?? {}) };
}

export function defaultSettings(): AppSettings {
	return {
		version: 1,
		theme: "system",
		accent: "teal",
		providers: [],
		pii: defaultPiiSettings(),
		notifications: { enabled: true, sound: true, showPreview: true },
		links: { globalDailyBudget: 200, maxDepth: 3, replyTimeoutSec: 120 },
		runtime: { idleDisposeMinutes: 15, maxConcurrentRuns: 4 },
		background: {
			runInBackground: true,
			launchAtLogin: false,
			hideDockWhenClosed: false,
			keepAwake: false,
			maxCostUsdPerDay: 10,
			paused: false,
		},
		localWebhook: { enabled: false, port: 47615 },
		onboardingDone: false,
		telemetry: false,
	};
}

export function defaultPersona(name = "Dot"): Persona {
	return {
		role: `You are ${name}, a friendly general helper. Ask a clarifying question when a request is ambiguous.`,
		tone: "warm",
		verbosity: 40,
		formality: 40,
		emojiUsage: 25,
		quirks: [],
		dos: [],
		donts: [],
		customInstructions: "",
		greeting: `Hi, I'm ${name}! What can I help you with?`,
	};
}

export function defaultAlwaysOn(): AlwaysOnSettings {
	return {
		enabled: false,
		standingInstructions: "",
		notify: "updates",
		batchWindowSec: 10,
		budget: { maxTurnsPerHour: 20, maxCostUsdPerDay: 2 },
	};
}

export function emptyProfile(): DotProfile {
	return { capabilities: [], dataSources: [], knowledgeSummary: "", updatedAt: new Date(0).toISOString() };
}

export function defaultUiState(): UiState {
	return { drafts: {}, listWidth: 360, drawerOpen: false };
}

export const LIMITS = {
	nameMax: 32,
	taglineMax: 60,
	chatMax: 100_000,
	roleMax: 600,
	customInstructionsMax: 4000,
	quirksMax: 5,
	dosMax: 10,
	creationPromptMin: 10,
	creationPromptMax: 2000,
	maxDots: 50,
	memoryItemMax: 500,
	dotMemoryItems: 200,
	userMemoryItems: 100,
} as const;
