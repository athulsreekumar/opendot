// The renderer ⇄ main contract. Spec: docs/spec/02-data-and-ipc.md §3
import type {
	AddProviderInput,
	ApprovalRequest,
	ApprovalResponse,
	AppSettings,
	AuditEntry,
	AuditKind,
	CatalogEntry,
	ChatEvent,
	ChatMessageView,
	Connection,
	ConnectionId,
	ConnectionPatch,
	ConnectionStatus,
	ConnectorChoice,
	CreateDotInput,
	Dot,
	DotDraft,
	DotEventView,
	DotHealth,
	DotId,
	DotLink,
	DotPatch,
	DotStatus,
	DotTemplate,
	InstallConnectionInput,
	ISODate,
	KnowledgeFolderView,
	KnowledgeState,
	LinkDecision,
	LinkExchange,
	LinkId,
	MacCapability,
	MacPermissionStatus,
	MemoryItem,
	MessageId,
	ModelOption,
	OAuthClientInput,
	PiiType,
	ProviderSettings,
	UiState,
	UpsertLinkInput,
	Watcher,
	WatcherConfig,
	WatcherId,
	WatcherType,
} from "./types";

export type MemoryScope = DotId | "user";

export interface OpenDotApi {
	app: {
		info(): Promise<{
			version: string;
			dataDir: string;
			platform: string;
			piVersion: string;
			e2e: boolean;
			/** False on Windows when no bash (Git for Windows) is installed, so the shell tool is not offered. */
			shellAvailable: boolean;
		}>;
		openExternal(url: string): Promise<void>;
		revealDataDir(): Promise<void>;
		pickFolder(opts?: { title?: string }): Promise<string | undefined>;
		revealPath(path: string): Promise<void>;
		setLaunchAtLogin(on: boolean): Promise<void>;
		reset(): Promise<void>;
		getUiState(): Promise<UiState>;
		setUiState(patch: Partial<UiState>): Promise<void>;
	};
	settings: {
		get(): Promise<AppSettings>;
		update(patch: Partial<Omit<AppSettings, "version" | "providers" | "telemetry">>): Promise<AppSettings>;
	};
	models: {
		listProviders(): Promise<ProviderSettings[]>;
		builtinProviders(): Promise<Array<{ id: string; label: string; keyUrl?: string; featured: boolean }>>;
		addProvider(input: AddProviderInput): Promise<ProviderSettings>;
		updateProvider(
			id: string,
			patch: Partial<Pick<ProviderSettings, "label" | "baseUrl" | "headers" | "enabled" | "models" | "api">>,
		): Promise<ProviderSettings>;
		removeProvider(id: string): Promise<void>;
		setSecret(providerId: string, secret: string): Promise<void>;
		clearSecret(providerId: string): Promise<void>;
		discover(providerId: string): Promise<Array<{ id: string; label?: string }>>;
		test(providerId: string, modelId?: string): Promise<{ ok: boolean; latencyMs?: number; message: string }>;
		listModels(): Promise<ModelOption[]>;
		detectLocal(): Promise<Array<{ preset: "ollama" | "lmstudio" | "llamacpp" | "vllm"; baseUrl: string }>>;
	};
	dots: {
		list(): Promise<Dot[]>;
		get(id: DotId): Promise<Dot>;
		create(input: CreateDotInput): Promise<Dot>;
		update(id: DotId, patch: DotPatch): Promise<Dot>;
		remove(id: DotId): Promise<void>;
		duplicate(id: DotId): Promise<Dot>;
		markRead(id: DotId): Promise<void>;
		templates(): Promise<DotTemplate[]>;
		draftFromDescription(
			input: { prompt: string; connectors: ConnectorChoice[] },
			requestId?: string,
		): Promise<DotDraft>;
		connectorChoices(): Promise<ConnectorChoice[]>;
		status(id: DotId): Promise<DotStatus>;
		compiledPrompt(id: DotId): Promise<string>;
		alwaysAllowed(id: DotId): Promise<string[]>;
		forgetAllowed(id: DotId, toolName?: string): Promise<void>;
	};
	chat: {
		history(
			dotId: DotId,
			opts?: { before?: MessageId; limit?: number },
		): Promise<{ messages: ChatMessageView[]; hasMore: boolean }>;
		send(
			dotId: DotId,
			text: string,
			opts?: { mode?: "auto" | "steer" | "followUp"; clientNonce?: string },
		): Promise<{ accepted: true; queued?: "steer" | "followUp" }>;
		abort(dotId: DotId): Promise<void>;
		clear(dotId: DotId): Promise<void>;
		linkHistory(dotId: DotId, peerDotId: DotId): Promise<ChatMessageView[]>;
	};
	connections: {
		catalog(): Promise<CatalogEntry[]>;
		list(): Promise<Connection[]>;
		install(input: InstallConnectionInput): Promise<Connection>;
		importJson(json: string): Promise<{ added: Connection[]; errors: string[] }>;
		update(id: ConnectionId, patch: ConnectionPatch): Promise<Connection>;
		remove(id: ConnectionId): Promise<void>;
		status(id?: ConnectionId): Promise<ConnectionStatus[]>;
		check(id: ConnectionId): Promise<ConnectionStatus>;
		configureOAuth(type: "google" | "microsoft", input: OAuthClientInput): Promise<Connection>;
		signIn(id: ConnectionId): Promise<{ account?: string }>;
		signOut(id: ConnectionId): Promise<void>;
		macPermissions(): Promise<MacPermissionStatus[]>;
		requestMacPermission(cap: MacCapability): Promise<MacPermissionStatus>;
		nodeAvailable(): Promise<{ node?: string; npx: boolean; uvx: boolean }>;
	};
	approvals: {
		pending(): Promise<ApprovalRequest[]>;
		respond(res: ApprovalResponse): Promise<void>;
	};
	links: {
		list(): Promise<DotLink[]>;
		upsert(input: UpsertLinkInput): Promise<DotLink>;
		remove(id: LinkId): Promise<void>;
		exchanges(opts?: { dotId?: DotId; limit?: number }): Promise<LinkExchange[]>;
		simulate(from: DotId, to: DotId, at?: ISODate): Promise<LinkDecision>;
	};
	pii: {
		preview(
			text: string,
			dotId?: DotId,
		): Promise<{ redacted: string; items: Array<{ type: PiiType; start: number; end: number }> }>;
	};
	audit: {
		query(q: { dotId?: DotId; kinds?: AuditKind[]; before?: ISODate; limit?: number }): Promise<AuditEntry[]>;
		exportJsonl(): Promise<{ path: string }>;
	};
	watchers: {
		list(dotId?: DotId): Promise<Watcher[]>;
		create(input: {
			dotId: DotId;
			type: WatcherType;
			label?: string;
			config: WatcherConfig;
			intervalSec?: number;
		}): Promise<Watcher>;
		update(
			id: WatcherId,
			patch: Partial<Pick<Watcher, "label" | "enabled" | "config" | "intervalSec">>,
		): Promise<Watcher>;
		remove(id: WatcherId): Promise<void>;
		test(input: {
			type: WatcherType;
			config: WatcherConfig;
			dotId: DotId;
		}): Promise<{ ok: boolean; message: string; sample?: DotEventView[] }>;
		runNow(id: WatcherId): Promise<void>;
		webhookInfo(id: WatcherId): Promise<{ url: string; token: string; curl: string }>;
		types(): Promise<
			Array<{
				type: WatcherType;
				label: string;
				available: boolean;
				reason?: string;
				defaultIntervalSec: number;
				minIntervalSec: number;
				push: boolean;
			}>
		>;
	};
	events: {
		list(dotId: DotId, opts?: { before?: ISODate; limit?: number }): Promise<DotEventView[]>;
	};
	runtime: {
		health(): Promise<DotHealth[]>;
		pauseAll(paused: boolean): Promise<void>;
		setAlwaysOn(dotId: DotId, enabled: boolean): Promise<Dot>;
	};
	superbot: {
		get(): Promise<Dot>;
		directory(): Promise<Array<{ dotId: DotId; name: string; card: string }>>;
		refreshProfiles(): Promise<void>;
	};
	memory: {
		get(scope: MemoryScope): Promise<MemoryItem[]>;
		upsert(scope: MemoryScope, item: { id?: string; text: string; pinned?: boolean }): Promise<MemoryItem>;
		remove(scope: MemoryScope, id: string): Promise<void>;
	};
	knowledge: {
		state(): Promise<KnowledgeState>;
		addFolder(path: string): Promise<KnowledgeFolderView>;
		removeFolder(id: string): Promise<void>;
		/** Re-scan one folder, or all when no id is given. `full` re-reads every file. */
		reindex(id?: string, full?: boolean): Promise<void>;
		/** Open a source file with the OS (documents) or show it in its folder (code and data). */
		open(path: string): Promise<void>;
		reveal(path: string): Promise<void>;
	};
	on<E extends keyof EventMap>(event: E, listener: (payload: EventMap[E]) => void): () => void;
}

export interface EventMap {
	"dot:event": ChatEvent;
	"approval:requested": ApprovalRequest;
	"approval:resolved": { id: ApprovalRequest["id"]; decision: ApprovalResponse["decision"] | "expired" };
	"connection:status": ConnectionStatus;
	"link:exchange": LinkExchange;
	"settings:changed": AppSettings;
	"dots:changed": Dot[];
	"app:focus-dot": { dotId: DotId };
	"dots:draft-stream": { requestId: string; delta: string };
	"runtime:health": DotHealth;
	"watcher:changed": Watcher;
	"connections:changed": Connection[];
	"app:navigate": { hash: string };
	"knowledge:changed": KnowledgeState;
}

export const INVOKE_CHANNELS = [
	"app.info",
	"app.openExternal",
	"app.revealDataDir",
	"app.pickFolder",
	"app.revealPath",
	"app.setLaunchAtLogin",
	"app.reset",
	"app.getUiState",
	"app.setUiState",
	"settings.get",
	"settings.update",
	"models.listProviders",
	"models.builtinProviders",
	"models.addProvider",
	"models.updateProvider",
	"models.removeProvider",
	"models.setSecret",
	"models.clearSecret",
	"models.discover",
	"models.test",
	"models.listModels",
	"models.detectLocal",
	"dots.list",
	"dots.get",
	"dots.create",
	"dots.update",
	"dots.remove",
	"dots.duplicate",
	"dots.markRead",
	"dots.templates",
	"dots.draftFromDescription",
	"dots.connectorChoices",
	"dots.status",
	"dots.compiledPrompt",
	"dots.alwaysAllowed",
	"dots.forgetAllowed",
	"chat.history",
	"chat.send",
	"chat.abort",
	"chat.clear",
	"chat.linkHistory",
	"connections.catalog",
	"connections.list",
	"connections.install",
	"connections.importJson",
	"connections.update",
	"connections.remove",
	"connections.status",
	"connections.check",
	"connections.configureOAuth",
	"connections.signIn",
	"connections.signOut",
	"connections.macPermissions",
	"connections.requestMacPermission",
	"connections.nodeAvailable",
	"approvals.pending",
	"approvals.respond",
	"links.list",
	"links.upsert",
	"links.remove",
	"links.exchanges",
	"links.simulate",
	"pii.preview",
	"audit.query",
	"audit.exportJsonl",
	"watchers.list",
	"watchers.create",
	"watchers.update",
	"watchers.remove",
	"watchers.test",
	"watchers.runNow",
	"watchers.webhookInfo",
	"watchers.types",
	"events.list",
	"runtime.health",
	"runtime.pauseAll",
	"runtime.setAlwaysOn",
	"superbot.get",
	"superbot.directory",
	"superbot.refreshProfiles",
	"memory.get",
	"memory.upsert",
	"memory.remove",
	"knowledge.state",
	"knowledge.addFolder",
	"knowledge.removeFolder",
	"knowledge.reindex",
	"knowledge.open",
	"knowledge.reveal",
] as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number];

export const EVENT_CHANNELS = [
	"dot:event",
	"approval:requested",
	"approval:resolved",
	"connection:status",
	"link:exchange",
	"settings:changed",
	"dots:changed",
	"app:focus-dot",
	"dots:draft-stream",
	"runtime:health",
	"watcher:changed",
	"connections:changed",
	"app:navigate",
	"knowledge:changed",
] as const;

/** Maps "ns.method" channel to the api function type. */
type ApiNs = Omit<OpenDotApi, "on">;
type ChannelFn<C extends string> = C extends `${infer N}.${infer M}`
	? N extends keyof ApiNs
		? M extends keyof ApiNs[N]
			? ApiNs[N][M]
			: never
		: never
	: never;

export type IpcHandlers = {
	[C in InvokeChannel]: ChannelFn<C> extends (...args: infer A) => infer R ? (...args: A) => R : never;
};

/** Test-only API exposed as window.opendotTest when OPENDOT_E2E=1. */
export interface OpenDotTestApi {
	setFakeScript(name: string): Promise<void>;
	appendFakeScript(name: string): Promise<void>;
	getCaptured(): Promise<string[]>;
	reportPaint(messageId: string, at: number): Promise<void>;
	getPaints(): Promise<Array<{ messageId: string; firstTokenAt?: number; paintAt: number }>>;
	emitEvent(dotId: string, title: string, body: string, importance?: "low" | "normal" | "high"): Promise<void>;
	/** Add a folder to Knowledge without the native folder picker. */
	knowledgeAddFolder(path: string): Promise<KnowledgeFolderView>;
}
