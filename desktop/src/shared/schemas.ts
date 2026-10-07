// zod schemas for persisted data and IPC arguments. Spec 02 §3.4.
import { z } from "zod";
import { LIMITS } from "./defaults";
import type { AppSettings, Connection, Dot, DotLink, MemoryItem, UiState, Watcher } from "./types";

const iso = z.string();
export const DotIdSchema = z.string().regex(/^dot_[A-Za-z0-9_-]{6,40}$/) as unknown as z.ZodType<`dot_${string}`>;
export const ConnectionIdSchema = z
	.string()
	.regex(/^con_[A-Za-z0-9_-]{6,40}$/) as unknown as z.ZodType<`con_${string}`>;
export const LinkIdSchema = z.string().regex(/^lnk_[A-Za-z0-9_-]{6,40}$/) as unknown as z.ZodType<`lnk_${string}`>;
export const WatcherIdSchema = z.string().regex(/^wat_[A-Za-z0-9_-]{6,40}$/) as unknown as z.ZodType<`wat_${string}`>;
export const ApprovalIdSchema = z.string().regex(/^apr_[A-Za-z0-9_-]{6,40}$/) as unknown as z.ZodType<`apr_${string}`>;

export const DotColorSchema = z.enum([
	"teal",
	"green",
	"lime",
	"amber",
	"orange",
	"rose",
	"pink",
	"violet",
	"indigo",
	"blue",
	"sky",
	"slate",
]);
export const ThinkingSchema = z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
export const ToneSchema = z.enum(["warm", "neutral", "playful", "direct", "formal"]);
export const ToolDecisionSchema = z.enum(["allow", "ask", "deny"]);
export const ExposureSchema = z.enum(["direct", "deferred", "codemode", "hidden"]);
export const ModelRefSchema = z.object({ providerId: z.string().min(1), modelId: z.string().min(1) });

export const PersonaSchema = z.object({
	role: z.string().max(LIMITS.roleMax * 2),
	tone: ToneSchema,
	verbosity: z.number().min(0).max(100),
	formality: z.number().min(0).max(100),
	emojiUsage: z.number().min(0).max(100),
	quirks: z.array(z.string().max(80)).max(LIMITS.quirksMax),
	dos: z.array(z.string().max(160)).max(LIMITS.dosMax),
	donts: z.array(z.string().max(160)).max(LIMITS.dosMax),
	customInstructions: z.string().max(LIMITS.customInstructionsMax),
	greeting: z.string().max(400),
});

export const LinkScheduleSchema = z.object({
	timeZone: z.string().min(1),
	days: z.array(z.number().int().min(0).max(6)),
	start: z.string().regex(/^\d{2}:\d{2}$/),
	end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const AlwaysOnSchema = z.object({
	enabled: z.boolean(),
	standingInstructions: z.string().max(2000),
	notify: z.enum(["urgent", "updates", "none"]),
	quietHours: LinkScheduleSchema.optional(),
	batchWindowSec: z.number().min(0).max(300),
	budget: z.object({ maxTurnsPerHour: z.number().min(1).max(500), maxCostUsdPerDay: z.number().min(0).max(1000) }),
});

export const GrantSchema = z.object({
	connectionId: ConnectionIdSchema,
	defaultDecision: ToolDecisionSchema.optional(),
	toolRules: z.record(z.string(), ToolDecisionSchema),
	features: z.array(z.string()).optional(),
});

export const DotSchema = z.object({
	id: DotIdSchema,
	kind: z.enum(["standard", "super"]),
	name: z.string().min(1).max(LIMITS.nameMax),
	tagline: z.string().max(LIMITS.taglineMax * 2),
	appearance: z.object({ emoji: z.string().min(1).max(16), color: DotColorSchema }),
	persona: PersonaSchema,
	templateId: z.string().optional(),
	creationPrompt: z.string().max(LIMITS.creationPromptMax).optional(),
	suggestedConnections: z.array(z.string()),
	model: ModelRefSchema.optional(),
	thinkingLevel: ThinkingSchema,
	grants: z.array(GrantSchema),
	roles: z.array(z.string().regex(/^[a-z0-9-]{1,32}$/)).max(8),
	piiMode: z.enum(["auto", "always", "off"]),
	alwaysOn: AlwaysOnSchema,
	profile: z.object({
		capabilities: z.array(z.string()),
		dataSources: z.array(z.string()),
		knowledgeSummary: z.string(),
		updatedAt: iso,
	}),
	hiddenFromSuper: z.boolean(),
	workspaceDir: z.string(),
	pinned: z.boolean(),
	muted: z.boolean(),
	archived: z.boolean(),
	createdAt: iso,
	updatedAt: iso,
	lastActivityAt: iso,
	lastMessagePreview: z.string(),
	unreadCount: z.number().int().min(0),
}) as unknown as z.ZodType<Dot>;

const ProviderSchema = z.object({
	id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
	kind: z.enum(["cloud", "self-hosted", "custom-url"]),
	label: z.string().min(1).max(60),
	builtinProviderId: z.string().optional(),
	preset: z.enum(["ollama", "lmstudio", "llamacpp", "vllm"]).optional(),
	baseUrl: z.string().optional(),
	api: z.enum(["openai-completions", "openai-responses", "anthropic-messages"]).optional(),
	headers: z.record(z.string(), z.string()).optional(),
	models: z
		.array(
			z.object({
				id: z.string().min(1),
				label: z.string().optional(),
				contextWindow: z.number().optional(),
				vision: z.boolean().optional(),
				reasoning: z.boolean().optional(),
			}),
		)
		.optional(),
	isLocal: z.boolean(),
	enabled: z.boolean(),
	hasSecret: z.boolean(),
	secretHint: z.string().optional(),
	lastTest: z.object({ ok: z.boolean(), message: z.string(), at: iso }).optional(),
	createdAt: iso,
});

export const BriefingSettingsSchema = z.object({
	enabled: z.boolean().default(false),
	time: z
		.string()
		.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
		.default("08:00"),
	days: z.enum(["weekdays", "daily"]).default("weekdays"),
	dots: z.record(z.string(), z.boolean()).default({}),
	instructions: z.string().max(1000).default(""),
});

export const SettingsSchema = z.object({
	version: z.literal(1),
	theme: z.enum(["light", "dark", "system"]),
	accent: DotColorSchema,
	defaultModel: ModelRefSchema.optional(),
	providers: z.array(ProviderSchema),
	pii: z.object({
		enabledTypes: z.array(z.string()),
		customTerms: z.array(z.object({ term: z.string().min(1).max(200), type: z.enum(["CUSTOM", "PERSON", "ADDRESS"]) })),
		detectNames: z.boolean(),
	}),
	notifications: z.object({ enabled: z.boolean(), sound: z.boolean(), showPreview: z.boolean() }),
	links: z.object({
		globalDailyBudget: z.number().min(1),
		maxDepth: z.number().min(1).max(6),
		replyTimeoutSec: z.number().min(5).max(1800),
	}),
	runtime: z.object({ idleDisposeMinutes: z.number().min(1), maxConcurrentRuns: z.number().min(1).max(32) }),
	background: z.object({
		runInBackground: z.boolean(),
		launchAtLogin: z.boolean(),
		hideDockWhenClosed: z.boolean(),
		keepAwake: z.boolean(),
		maxCostUsdPerDay: z.number().min(0),
		paused: z.boolean(),
	}),
	localWebhook: z.object({ enabled: z.boolean(), port: z.number().int().min(1024).max(65535) }),
	onboardingDone: z.boolean(),
	telemetry: z.literal(false),
	briefing: BriefingSettingsSchema.optional(),
	quickAsk: z.object({ enabled: z.boolean(), shortcut: z.string().min(1).max(60) }).optional(),
}) as unknown as z.ZodType<AppSettings>;

export const ConnectionSchema = z.object({
	id: ConnectionIdSchema,
	type: z.enum(["mcp-stdio", "mcp-http", "google", "microsoft", "mac"]),
	name: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
	label: z.string().min(1).max(80),
	description: z.string().max(400),
	icon: z.string(),
	catalogId: z.string().optional(),
	enabled: z.boolean(),
	stdio: z
		.object({
			command: z.string().min(1),
			args: z.array(z.string()),
			env: z.record(z.string(), z.string()),
			cwd: z.string().optional(),
		})
		.optional(),
	http: z
		.object({
			url: z.string().url(),
			headers: z.record(z.string(), z.string()),
			oauth: z
				.object({
					clientId: z.string().optional(),
					clientName: z.string().optional(),
					scope: z.string().optional(),
					callbackPort: z.number().optional(),
				})
				.optional(),
		})
		.optional(),
	exposure: ExposureSchema,
	toolExposure: z.record(z.string(), ExposureSchema),
	features: z.array(z.string()),
	account: z.string().optional(),
	configured: z.boolean().optional(),
	createdAt: iso,
}) as unknown as z.ZodType<Connection>;

export const LinkSubjectSchema = z.union([
	z.object({ kind: z.literal("dot"), dotId: DotIdSchema }),
	z.object({ kind: z.literal("role"), role: z.string().min(1) }),
	z.object({ kind: z.literal("super") }),
	z.object({ kind: z.literal("any") }),
]);

export const DotLinkSchema = z.object({
	id: LinkIdSchema,
	from: LinkSubjectSchema,
	to: LinkSubjectSchema,
	effect: z.enum(["allow", "deny"]),
	enabled: z.boolean(),
	approval: z.enum(["auto", "ask"]),
	schedule: LinkScheduleSchema.optional(),
	maxPerHour: z.number().int().min(1).max(500),
	sharePii: z.boolean(),
	purpose: z.string().max(200),
	createdAt: iso,
}) as unknown as z.ZodType<DotLink>;

export const WatcherTypeSchema = z.enum([
	"schedule",
	"folder",
	"url",
	"rss",
	"local-webhook",
	"gmail",
	"google-calendar",
	"google-drive",
	"outlook-mail",
	"outlook-calendar",
	"onedrive",
	"teams-chat",
	"mcp-resource",
	"mcp-poll",
	"mac-calendar",
	"mac-reminders",
]);

export const WatcherConfigSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
);

export const WatcherSchema = z.object({
	id: WatcherIdSchema,
	dotId: DotIdSchema,
	type: WatcherTypeSchema,
	label: z.string().min(1).max(100),
	enabled: z.boolean(),
	config: WatcherConfigSchema,
	intervalSec: z.number().min(1),
	cursor: z.string().optional(),
	state: z.enum(["idle", "running", "backoff", "error", "needs-auth", "paused"]),
	failures: z.number().int().min(0),
	lastRunAt: iso.optional(),
	lastEventAt: iso.optional(),
	nextRunAt: iso.optional(),
	lastError: z.string().optional(),
	createdAt: iso,
}) as unknown as z.ZodType<Watcher>;

export const MemoryItemSchema = z.object({
	id: z.string(),
	text: z.string().min(1).max(LIMITS.memoryItemMax),
	createdAt: iso,
	updatedAt: iso,
	source: z.enum(["user", "dot"]),
	pinned: z.boolean(),
}) as unknown as z.ZodType<MemoryItem>;

export const MemorySchema = z.object({ items: z.array(MemoryItemSchema) });

export const UiStateSchema = z.object({
	selectedDotId: DotIdSchema.optional(),
	drafts: z.record(z.string(), z.string()),
	listWidth: z.number(),
	drawerOpen: z.boolean(),
	window: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
}) as unknown as z.ZodType<UiState>;

export const PolicySchema = z.object({
	rules: z.array(z.object({ dotId: z.string(), toolName: z.string(), createdAt: iso })),
});
export type PolicyData = z.infer<typeof PolicySchema>;

export const UsageSchema = z.object({
	/** dotId → hourKey ("2026-10-04T14") → { turns, cost } */
	hourly: z.record(z.string(), z.record(z.string(), z.object({ turns: z.number(), cost: z.number() }))),
	/** dotId → dayKey ("2026-10-04") → { turns, cost } */
	daily: z.record(z.string(), z.record(z.string(), z.object({ turns: z.number(), cost: z.number() }))),
});
export type UsageData = z.infer<typeof UsageSchema>;

// ── IPC argument schemas (only the channels whose inputs need checking; others accept any) ──
const text = (max: number) => z.string().max(max);
export const ARG_SCHEMAS: Partial<Record<string, z.ZodType<unknown[]>>> = {
	"chat.send": z.tuple([
		DotIdSchema,
		text(LIMITS.chatMax).min(1),
		z
			.object({ mode: z.enum(["auto", "steer", "followUp"]).optional(), clientNonce: z.string().max(64).optional() })
			.optional(),
	]) as unknown as z.ZodType<unknown[]>,
	"chat.history": z.tuple([
		DotIdSchema,
		z.object({ before: z.string().optional(), limit: z.number().int().min(1).max(500).optional() }).optional(),
	]) as unknown as z.ZodType<unknown[]>,
	"quickAsk.resize": z.tuple([z.number().finite()]) as unknown as z.ZodType<unknown[]>,
	"quickAsk.openInApp": z.tuple([DotIdSchema]) as unknown as z.ZodType<unknown[]>,
	"quickAsk.report": z.tuple([
		z.object({ dotId: DotIdSchema.optional(), pinned: z.boolean() }),
	]) as unknown as z.ZodType<unknown[]>,
	"dots.get": z.tuple([DotIdSchema]) as unknown as z.ZodType<unknown[]>,
	"dots.remove": z.tuple([DotIdSchema]) as unknown as z.ZodType<unknown[]>,
	"app.openExternal": z.tuple([
		z.string().regex(/^(https:|mailto:|x-apple\.systempreferences:)/),
	]) as unknown as z.ZodType<unknown[]>,
	"models.setSecret": z.tuple([z.string().min(1), z.string().min(1).max(8000)]) as unknown as z.ZodType<unknown[]>,
	"dots.draftFromDescription": z.tuple([
		z.object({
			prompt: z.string().min(LIMITS.creationPromptMin).max(LIMITS.creationPromptMax),
			connectors: z.array(z.object({ id: z.string(), label: z.string() }).passthrough()).max(40),
		}),
		z.string().max(64).optional(),
	]) as unknown as z.ZodType<unknown[]>,
};
