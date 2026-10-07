// One DotHost per Dot: owns its pi AgentSession(s), maps pi events to ChatEvents (spec 03, 14).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseAttachmentBlocks } from "../../shared/attachments";
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type {
	ChatEvent,
	ChatMessageView,
	Dot,
	DotEventView,
	DotId,
	DotStatus,
	MessageId,
	ToolCallView,
} from "../../shared/types";
import type { AttachmentItem, AttachmentService } from "../attachments/attachment-service";
import { log } from "../log";
import type { ModelService } from "../models/model-service";
import type { Paths } from "../paths";
import type { PiiService } from "../pii/pii-service";
import type { SettingsService } from "../settings-service";
import type { Store } from "../store/store";
import {
	type AgentSession,
	type AgentSessionEvent,
	createAgentSession,
	DefaultResourceLoader,
	type InlineExtension,
	SessionManager,
	SettingsManager,
} from "./pi-adapter";
import { StreamEmitter } from "./stream-emitter";
import { compileSystemPrompt } from "./system-prompt";
import {
	type AnyMessage,
	blocksText,
	type EntryLike,
	entriesToViews,
	humanToolLabel,
	previewLine,
	previewOf,
} from "./views";

export type SessionKind = "main" | "link";

export interface SessionCtx {
	kind: SessionKind;
	/** For link sessions: the asking Dot. */
	peerId?: DotId;
	/** Current link chain, read by the links extension. */
	chain: () => DotId[];
	/** For link sessions: purpose of the link. */
	linkPurpose?: string;
	peerName?: string;
	peerTagline?: string;
}

export interface DotHostDeps {
	paths: Paths;
	store: Store;
	settings: SettingsService;
	models: ModelService;
	attachments: AttachmentService;
	pii: PiiService;
	emit: (e: ChatEvent) => void;
	buildExtensions: (dot: Dot, ctx: SessionCtx) => Promise<InlineExtension[]>;
	grantedBuiltins: (dot: Dot) => string[];
	getDot: (id: DotId) => Promise<Dot | undefined>;
	updateDot: (id: DotId, fn: (d: Dot) => Dot) => Promise<Dot>;
	isFocused: (id: DotId) => boolean;
	acquireRunSlot: () => Promise<() => void>;
	onAssistantEnd?: (info: AssistantEndInfo) => void;
	onCancelApprovals?: (dotId: DotId) => void;
}

export interface AssistantEndInfo {
	dot: Dot;
	text: string;
	importance?: "urgent" | "update" | "quiet";
	hidden: boolean;
	runKind: RunKind;
	costUsd: number;
	/** Events handled by this run (events runs only). */
	eventIds?: string[];
	error?: string;
}

type RunKind = "user" | "events" | "link";

interface LinkSession {
	session: AgentSession;
	chain: DotId[];
	queue: Promise<unknown>;
	unsub: () => void;
	onDelta?: (delta: string) => void;
	text: string;
}

export class DotHost {
	private session: AgentSession | undefined;
	private creating: Promise<AgentSession> | undefined;
	private unsub: (() => void) | undefined;
	private emitter: StreamEmitter;
	private _status: DotStatus = { kind: "idle" };
	private runKind: RunKind | undefined;
	private releaseSlot: (() => void) | undefined;
	private pendingNonce: string | undefined;
	private pendingSentAt: number | undefined;
	private needsRecreate = false;
	private lastPrompt = "";
	private toolMsg = new Map<string, MessageId>();
	private tools = new Map<string, ToolCallView>();
	private currentAssistant: ChatMessageView | undefined;
	private linkSessions = new Map<DotId, LinkSession>();
	private runEventIds: string[] = [];
	/** Files the user attached to the current SuperDot turn; forwarded by ask_dots. */
	private turnAttachments: AttachmentItem[] = [];
	lastActivity = Date.now();
	disposed = false;

	constructor(
		private readonly deps: DotHostDeps,
		readonly dotId: DotId,
	) {
		this.emitter = new StreamEmitter({ dotId, emit: deps.emit, restore: (s) => deps.pii.restore(dotId, s) });
	}

	get status(): DotStatus {
		return this._status;
	}
	get isStreaming(): boolean {
		return !!this.session?.isStreaming;
	}
	get isWarm(): boolean {
		return !!this.session;
	}
	get isBusy(): boolean {
		return (
			this.isStreaming ||
			(this.linkSessions.size > 0 && [...this.linkSessions.values()].some((l) => l.session.isStreaming))
		);
	}

	private setStatus(s: DotStatus): void {
		this._status = s;
		this.deps.emit({ type: "status", dotId: this.dotId, status: s });
	}

	private async dot(): Promise<Dot> {
		const d = await this.deps.getDot(this.dotId);
		if (!d) throw new OpenDotError("NOT_FOUND", "This Dot no longer exists.");
		return d;
	}

	/** Build a pi session for this Dot (main chat or a link conversation). */
	private async createSession(dot: Dot, ctx: SessionCtx, sessionDir: string): Promise<AgentSession> {
		const cwd = dot.workspaceDir;
		mkdirSync(cwd, { recursive: true });
		mkdirSync(sessionDir, { recursive: true });
		await this.deps.pii.ensureVault(dot.id);
		// pi's built-in tools (read, ls, grep, find, write, edit, bash) come from This Mac's "files"/"shell" grants.
		// Pass the exact list in the initial settings: plain names replace pi's defaults (read, bash, edit, write)
		// and [] means none. ("+name" would ADD to those defaults, `noTools` would ignore this list, and
		// applyOverrides() is lost when pi reloads settings from storage.)
		const builtins = this.deps.grantedBuiltins(dot);
		const settingsManager = SettingsManager.inMemory({
			compaction: { enabled: true },
			retry: { enabled: true, maxRetries: 2 },
			defaultTools: [...builtins],
		} as never);
		let systemPrompt = compileSystemPrompt(dot);
		if (ctx.kind === "link") {
			systemPrompt += `\n\n## Incoming request from another Dot
You are answering ${ctx.peerName ?? "another Dot"}${ctx.peerTagline ? ` (${ctx.peerTagline})` : ""}, another assistant owned by the same user.
Purpose of this link: ${ctx.linkPurpose || "not specified"}.
Reply with the information requested, concisely. Your final message is returned to ${ctx.peerName ?? "the other Dot"} verbatim.
Do not ask the user questions in this conversation; if you can't proceed, say what is missing.`;
		}
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			agentDir: this.deps.paths.piDir,
			settingsManager,
			// noExtensions skips discovered extensions only; inline extensionFactories still load.
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
			systemPrompt,
			extensionFactories: await this.deps.buildExtensions(dot, ctx),
		});
		await resourceLoader.reload();
		const model = await this.deps.models.resolveModel(dot.model);
		const sessionManager = SessionManager.continueRecent(cwd, sessionDir);
		const { session } = await createAgentSession({
			cwd,
			agentDir: this.deps.paths.piDir,
			modelRuntime: this.deps.models.runtime,
			model,
			thinkingLevel: dot.thinkingLevel as never,
			resourceLoader,
			sessionManager,
			settingsManager,
			// Never pass `tools` (it would hide MCP and extension tools) or `noTools` (it would ignore defaultTools).
		});
		await session.bindExtensions({
			mode: "rpc",
			onError: (e: unknown) => log.warn(`[${dot.name}] extension error`, e),
		} as never);
		return session;
	}

	async ensureSession(): Promise<AgentSession> {
		if (this.needsRecreate && this.session && !this.session.isStreaming) {
			await this.disposeMain();
		}
		if (this.session) return this.session;
		if (this.creating) return this.creating;
		this.creating = (async () => {
			const dot = await this.dot();
			const s = await this.createSession(
				dot,
				{ kind: "main", chain: () => [this.dotId] },
				this.deps.paths.dotSessions(dot.id),
			);
			this.session = s;
			this.needsRecreate = false;
			this.lastPrompt = compileSystemPrompt(dot);
			this.unsub = s.subscribe((ev) => this.onEvent(ev));
			return s;
		})();
		try {
			return await this.creating;
		} finally {
			this.creating = undefined;
		}
	}

	/** A user message. Never awaits the run (spec 03 §3.1). */
	async send(
		text: string,
		mode: "auto" | "steer" | "followUp" = "auto",
		clientNonce?: string,
		attach?: { images: Array<{ type: "image"; data: string; mimeType: string }>; items?: AttachmentItem[] },
	): Promise<{ queued?: "steer" | "followUp" }> {
		this.lastActivity = Date.now();
		let session: AgentSession;
		try {
			session = await this.ensureSession();
		} catch (e) {
			this.reportError(e, false);
			throw e;
		}
		this.pendingNonce = clientNonce;
		this.pendingSentAt = Date.now();
		if (attach?.items?.length || !session.isStreaming) this.turnAttachments = attach?.items ?? [];
		const images = attach?.images.length ? attach.images : undefined;
		if (session.isStreaming) {
			const how: "steer" | "followUp" =
				mode === "steer"
					? "steer"
					: mode === "followUp"
						? "followUp"
						: this.runKind === "events"
							? "steer"
							: "followUp";
			if (how === "steer") await session.steer(text, images);
			else await session.followUp(text, images);
			return { queued: how };
		}
		await this.startRun("user", () => session.prompt(text, images ? { images } : undefined));
		return {};
	}

	/** Attachments of the current turn, for SuperDot's ask_dots fan-out. */
	currentAttachments(): AttachmentItem[] {
		return this.turnAttachments;
	}

	/** Deliver an events batch as a custom message (spec 12 §2.3). */
	async deliverEvents(content: string, events: DotEventView[]): Promise<void> {
		this.lastActivity = Date.now();
		const session = await this.ensureSession();
		this.deps.emit({
			type: "message-start",
			dotId: this.dotId,
			message: {
				id: newId("msg"),
				dotId: this.dotId,
				role: "event",
				text: "",
				toolCalls: [],
				createdAt: new Date().toISOString(),
				streaming: false,
				events,
			},
		});
		this.runEventIds.push(...events.map((e) => e.id));
		const msg = {
			customType: "opendot.events",
			content,
			display: true,
			details: { eventIds: events.map((e) => e.id) },
		};
		if (session.isStreaming) {
			void session
				.sendCustomMessage(msg, { triggerTurn: true, deliverAs: "followUp" })
				.catch((e) => this.reportError(e, true));
			return;
		}
		await this.startRun("events", () => session.sendCustomMessage(msg, { triggerTurn: true, deliverAs: "followUp" }));
	}

	private async startRun(kind: RunKind, run: () => Promise<unknown>): Promise<void> {
		const release = await this.deps.acquireRunSlot();
		this.releaseSlot?.();
		this.releaseSlot = release;
		this.runKind = kind;
		this.setStatus(kind === "events" ? { kind: "handling-events", count: 1 } : { kind: "thinking" });
		void run()
			.catch((e) => this.reportError(e, true))
			.finally(() => {
				if (!this.session?.isStreaming) this.finishRun();
			});
	}

	private finishRun(): void {
		this.releaseSlot?.();
		this.releaseSlot = undefined;
		this.runKind = undefined;
		if (this._status.kind !== "error") this.setStatus({ kind: "idle" });
	}

	private reportError(e: unknown, retryable: boolean): void {
		const message = e instanceof Error ? e.message : String(e);
		log.warn(`[${this.dotId}] ${message}`);
		this.deps.emit({ type: "error", dotId: this.dotId, message, retryable });
		this.setStatus({ kind: "error", message });
	}

	async abort(): Promise<void> {
		this.deps.onCancelApprovals?.(this.dotId);
		await this.session?.abort();
		this.emitter.abort();
		this.finishRun();
	}

	// ─────────────────── pi event mapping (spec 03 §5, spec 14) ───────────────────
	private onEvent(ev: AgentSessionEvent): void {
		try {
			this.mapEvent(ev);
		} catch (e) {
			log.error("event mapping failed", e);
		}
	}

	private mapEvent(ev: AgentSessionEvent): void {
		const dotId = this.dotId;
		switch (ev.type) {
			case "agent_start":
				if (this._status.kind === "idle" || this._status.kind === "error")
					this.setStatus(this.runKind === "events" ? { kind: "handling-events", count: 1 } : { kind: "thinking" });
				break;
			case "message_start": {
				const m = ev.message as AnyMessage;
				if (m.role === "user") {
					const nonce = this.pendingNonce;
					this.pendingNonce = undefined;
					const parsed = parseAttachmentBlocks(this.deps.pii.restore(dotId, blocksText(m.content)), dotId);
					this.deps.emit({
						type: "message-start",
						dotId,
						clientNonce: nonce,
						message: {
							id: newId("msg"),
							dotId,
							role: "user",
							text: parsed.text,
							attachments: parsed.attachments.length ? parsed.attachments : undefined,
							toolCalls: [],
							createdAt: new Date(m.timestamp ?? Date.now()).toISOString(),
							streaming: false,
							timing: { sentAt: this.pendingSentAt },
						},
					});
				} else if (m.role === "assistant") {
					const view: ChatMessageView = {
						id: newId("msg"),
						dotId,
						role: "assistant",
						text: "",
						toolCalls: [],
						createdAt: new Date().toISOString(),
						streaming: true,
						timing: { sentAt: this.pendingSentAt },
					};
					this.currentAssistant = view;
					this.emitter.start(view, { tagHoldback: this.runKind === "events" });
					if (this.runKind !== "events") this.setStatus({ kind: "typing" });
				}
				break;
			}
			case "message_update": {
				const ae = ev.assistantMessageEvent;
				const view = this.currentAssistant;
				if (!view) break;
				if (ae.type === "text_delta") this.emitter.text(ae.delta);
				else if (ae.type === "thinking_delta") this.emitter.thinking(ae.delta);
				else if (ae.type === "toolcall_start") {
					const block = (ae.partial.content as Array<{ type: string; id?: string; name?: string }>)[ae.contentIndex];
					if (block?.id) {
						const tool: ToolCallView = {
							id: block.id,
							name: block.name ?? "",
							label: humanToolLabel(block.name ?? "tool"),
							args: {},
							status: "preparing",
							startedAt: new Date().toISOString(),
						};
						this.tools.set(block.id, tool);
						this.toolMsg.set(block.id, view.id);
						this.ensureStarted(view);
						this.deps.emit({ type: "tool-start", dotId, messageId: view.id, tool });
					}
				} else if (ae.type === "toolcall_delta") {
					const block = (ae.partial.content as Array<{ id?: string }>)[ae.contentIndex];
					if (block?.id) this.emitter.toolArgs(block.id, ae.delta);
				} else if (ae.type === "toolcall_end") {
					const tc = ae.toolCall;
					const tool = this.tools.get(tc.id) ?? {
						id: tc.id,
						name: tc.name,
						label: humanToolLabel(tc.name),
						args: {},
						status: "preparing" as const,
						startedAt: new Date().toISOString(),
					};
					tool.name = tc.name;
					tool.args = this.deps.pii.restoreDeep(dotId, tc.arguments);
					this.tools.set(tc.id, tool);
					this.toolMsg.set(tc.id, view.id);
					this.deps.emit({ type: "tool-update", dotId, messageId: view.id, tool: { ...tool } });
				}
				break;
			}
			case "message_end": {
				const m = ev.message as AnyMessage;
				if (m.role !== "assistant") break;
				const view = this.currentAssistant;
				this.currentAssistant = undefined;
				if (!view) break;
				const res = this.emitter.end({
					text: blocksText(m.content),
					thinking: blocksText(m.content, "thinking") || undefined,
				});
				const error = m.stopReason === "error" ? friendlyModelError(m.errorMessage) : undefined;
				const final: ChatMessageView = {
					...view,
					text: res.text,
					thinking: this.deps.pii.restore(dotId, blocksText(m.content, "thinking")) || undefined,
					streaming: false,
					toolCalls: [...this.tools.values()].filter((t) => this.toolMsg.get(t.id) === view.id),
					importance: res.importance,
					hidden: res.hidden,
					error,
					usage: m.usage
						? { input: m.usage.input ?? 0, output: m.usage.output ?? 0, costUsd: m.usage.cost?.total }
						: undefined,
					timing: { ...view.timing, firstTokenAt: res.firstTokenAt, endAt: Date.now() },
				};
				this.deps.emit({ type: "message-end", dotId, message: final });
				if (error) this.deps.emit({ type: "error", dotId, message: error, retryable: true });
				void this.afterAssistant(final, m.usage?.cost?.total ?? 0);
				break;
			}
			case "tool_execution_start": {
				const tool = this.tools.get(ev.toolCallId);
				const messageId = this.toolMsg.get(ev.toolCallId);
				if (tool && messageId) {
					tool.status = "running";
					tool.args = this.deps.pii.restoreDeep(this.dotId, ev.args);
					this.deps.emit({ type: "tool-update", dotId, messageId, tool: { ...tool } });
					this.setStatus({ kind: "tool", label: tool.label });
				}
				break;
			}
			case "tool_execution_update": {
				const tool = this.tools.get(ev.toolCallId);
				const messageId = this.toolMsg.get(ev.toolCallId);
				if (tool && messageId && ev.partialResult) {
					tool.resultPreview = this.deps.pii.restore(
						dotId,
						previewOf((ev.partialResult as { content?: unknown }).content ?? ""),
					);
					this.deps.emit({ type: "tool-update", dotId, messageId, tool: { ...tool } });
				}
				break;
			}
			case "tool_execution_end": {
				const tool = this.tools.get(ev.toolCallId);
				const messageId = this.toolMsg.get(ev.toolCallId);
				if (tool && messageId) {
					const result = ev.result as { content?: unknown } | undefined;
					const preview = this.deps.pii.restore(dotId, previewOf(result?.content ?? ""));
					const blocked = ev.isError && /Blocked by OpenDot|declined/i.test(preview);
					tool.status = blocked ? "blocked" : ev.isError ? "error" : "done";
					tool.isError = ev.isError;
					tool.resultPreview = preview;
					tool.endedAt = new Date().toISOString();
					this.deps.emit({ type: "tool-update", dotId, messageId, tool: { ...tool } });
					this.setStatus({ kind: "thinking" });
				}
				break;
			}
			case "auto_retry_start":
				this.setStatus({ kind: "thinking" });
				break;
			case "agent_settled":
				this.tools.clear();
				this.toolMsg.clear();
				this.finishRun();
				break;
			default:
				break;
		}
	}

	private ensureStarted(view: ChatMessageView): void {
		// Tool calls before any text in an events reply: release the holdback so the chip has a message to attach to.
		if (this.emitter.messageId === view.id) this.emitter.text("");
	}

	private async afterAssistant(final: ChatMessageView, cost: number): Promise<void> {
		const runKind = this.runKind ?? "user";
		const visible = !final.hidden && (final.text.trim().length > 0 || !!final.error);
		let dot: Dot | undefined;
		try {
			dot = await this.deps.updateDot(this.dotId, (d) => {
				if (!visible) return d;
				const focused = this.deps.isFocused(d.id);
				return {
					...d,
					lastActivityAt: new Date().toISOString(),
					lastMessagePreview: final.text ? previewLine(final.text) : d.lastMessagePreview,
					unreadCount: focused ? 0 : d.unreadCount + 1,
				};
			});
			this.deps.emit({ type: "dot-updated", dot });
		} catch {
			return;
		}
		this.deps.onAssistantEnd?.({
			dot,
			text: final.text,
			importance: final.importance,
			hidden: !!final.hidden,
			runKind,
			costUsd: cost,
			error: final.error,
			eventIds: runKind === "events" && (final.text.trim() || final.hidden) ? this.runEventIds.splice(0) : undefined,
		});
	}

	/** Stream a sub-answer from another Dot into the tool call's card (spec 13 §5). */
	private peerSeq = new Map<string, number>();
	emitPeer(
		toolCallId: string,
		peerDotId: DotId,
		status: "queued" | "running" | "done" | "error" | "blocked",
		patch: { delta?: string; text?: string; error?: string } = {},
	): void {
		const messageId = this.toolMsg.get(toolCallId);
		if (!messageId) return;
		const key = `${toolCallId}:${peerDotId}`;
		const seq = (this.peerSeq.get(key) ?? 0) + 1;
		this.peerSeq.set(key, seq);
		this.deps.emit({ type: "peer-stream", dotId: this.dotId, messageId, toolCallId, peerDotId, status, seq, ...patch });
	}

	// ─────────────────── history (spec 03 §6) ───────────────────
	async history(before?: MessageId, limit = 50): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
		const dot = await this.dot();
		await this.deps.pii.ensureVault(dot.id);
		let entries: EntryLike[];
		if (this.session) entries = this.session.sessionManager.getBranch() as unknown as EntryLike[];
		else {
			mkdirSync(this.deps.paths.dotSessions(dot.id), { recursive: true });
			const sm = SessionManager.continueRecent(dot.workspaceDir, this.deps.paths.dotSessions(dot.id));
			entries = sm.getBranch() as unknown as EntryLike[];
		}
		const events = new Map<string, DotEventView>();
		for (const e of await this.deps.store.events(dot.id).readAll()) {
			events.set(e.id, {
				id: e.id,
				type: e.type,
				title: e.title,
				facts: e.facts,
				importanceHint: e.importanceHint,
				occurredAt: e.occurredAt,
				status: e.status,
			});
		}
		let views = entriesToViews(dot.id, entries, (s) => this.deps.pii.restore(dot.id, s), events);
		// Merge Dot-Link exchanges (spec 07 §6).
		const exchanges = (await this.deps.store.exchanges()).filter((x) => x.to === dot.id);
		for (const x of exchanges) {
			views.push({
				id: `link_${x.id}`,
				dotId: dot.id,
				role: "link-in",
				text: x.request,
				toolCalls: [],
				createdAt: x.startedAt,
				streaming: false,
				peerDotId: x.from,
				exchangeId: x.id,
				error: x.status === "error" || x.status === "timeout" ? x.error : undefined,
				thinking: x.reply,
			});
		}
		views = views
			.filter((v) => !v.hidden || v.role !== "assistant")
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		// Synthetic greeting first.
		if (dot.persona.greeting.trim()) {
			views.unshift({
				id: `greeting_${dot.id}`,
				dotId: dot.id,
				role: "assistant",
				text: dot.persona.greeting,
				toolCalls: [],
				createdAt: views[0]?.createdAt ?? dot.createdAt,
				streaming: false,
			});
		}
		let end = views.length;
		if (before) {
			const i = views.findIndex((v) => v.id === before);
			if (i >= 0) end = i;
		}
		const start = Math.max(0, end - limit);
		return { messages: views.slice(start, end), hasMore: start > 0 };
	}

	// ─────────────────── link turns (spec 07 §4.1) ───────────────────
	async runLinkTurn(req: {
		from: Dot;
		message: string;
		purpose: string;
		chain: DotId[];
		signal?: AbortSignal;
		onDelta?: (delta: string) => void;
		/** Files from the user's SuperDot message, forwarded to this Dot. */
		attachments?: AttachmentItem[];
	}): Promise<string> {
		const dot = await this.dot();
		let ls = this.linkSessions.get(req.from.id);
		if (!ls) {
			const chainRef: { chain: DotId[] } = { chain: req.chain };
			const session = await this.createSession(
				dot,
				{
					kind: "link",
					peerId: req.from.id,
					chain: () => chainRef.chain,
					linkPurpose: req.purpose,
					peerName: req.from.name,
					peerTagline: req.from.tagline,
				},
				this.deps.paths.dotLinkSessions(dot.id, req.from.id),
			);
			const created: LinkSession = {
				session,
				chain: req.chain,
				queue: Promise.resolve(),
				unsub: () => undefined,
				text: "",
			};
			created.unsub = session.subscribe((ev) => {
				if (ev.type === "message_start" && (ev.message as AnyMessage).role === "assistant") created.text = "";
				if (ev.type === "message_update" && ev.assistantMessageEvent.type === "text_delta") {
					created.text += ev.assistantMessageEvent.delta;
					created.onDelta?.(ev.assistantMessageEvent.delta);
				}
			});
			Object.defineProperty(created, "chain", {
				get: () => chainRef.chain,
				set: (v: DotId[]) => {
					chainRef.chain = v;
				},
			});
			ls = created;
			this.linkSessions.set(req.from.id, ls);
		}
		const link = ls;
		const run = link.queue.then(async () => {
			link.chain = req.chain;
			link.onDelta = req.onDelta;
			const release = await this.deps.acquireRunSlot();
			const onAbort = () => void link.session.abort();
			req.signal?.addEventListener("abort", onAbort, { once: true });
			try {
				if (req.attachments?.length) {
					// Images only reach Dots whose model can see them; everyone gets a workspace copy.
					const rendered = await this.deps.attachments.render(dot, req.message, req.attachments, {
						supportsImages: await this.deps.attachments.supportsImages(dot),
					});
					await link.session.prompt(rendered.text, rendered.images.length ? { images: rendered.images } : undefined);
				} else await link.session.prompt(req.message);
				const msgs = link.session.messages as AnyMessage[];
				const last = [...msgs].reverse().find((m) => m.role === "assistant");
				if (last?.stopReason === "error") throw new Error(friendlyModelError(last.errorMessage));
				return this.deps.pii.restore(dot.id, blocksText(last?.content) || link.text);
			} finally {
				req.signal?.removeEventListener("abort", onAbort);
				link.onDelta = undefined;
				release();
			}
		});
		link.queue = run.catch(() => undefined);
		return run;
	}

	async linkHistory(peerId: DotId): Promise<ChatMessageView[]> {
		const dot = await this.dot();
		const ls = this.linkSessions.get(peerId);
		const entries = ls
			? (ls.session.sessionManager.getBranch() as unknown as EntryLike[])
			: (SessionManager.continueRecent(
					dot.workspaceDir,
					this.deps.paths.dotLinkSessions(dot.id, peerId),
				).getBranch() as unknown as EntryLike[]);
		return entriesToViews(dot.id, entries, (s) => this.deps.pii.restore(dot.id, s), new Map());
	}

	// ─────────────────── lifecycle ───────────────────
	/** spec 03 §7 */
	async applyDotChange(prev: Dot, next: Dot): Promise<void> {
		if (!this.session) return;
		const modelChanged = JSON.stringify(prev.model) !== JSON.stringify(next.model);
		if (modelChanged) {
			try {
				await this.session.setModel(await this.deps.models.resolveModel(next.model));
			} catch (e) {
				log.warn("setModel failed", e);
			}
		}
		if (prev.thinkingLevel !== next.thinkingLevel) this.session.setThinkingLevel(next.thinkingLevel as never);
		const structural =
			compileSystemPrompt(next) !== this.lastPrompt ||
			JSON.stringify(prev.grants) !== JSON.stringify(next.grants) ||
			prev.piiMode !== next.piiMode ||
			prev.workspaceDir !== next.workspaceDir ||
			JSON.stringify(prev.alwaysOn) !== JSON.stringify(next.alwaysOn) ||
			prev.hiddenFromSuper !== next.hiddenFromSuper;
		if (structural) this.markNeedsRecreate();
	}

	markNeedsRecreate(): void {
		this.needsRecreate = true;
		for (const [id, ls] of this.linkSessions) {
			if (!ls.session.isStreaming) {
				ls.unsub();
				ls.session.dispose();
				this.linkSessions.delete(id);
			}
		}
	}

	async clear(): Promise<void> {
		await this.abort();
		await this.disposeMain();
		const { rename, mkdir, readdir } = await import("node:fs/promises");
		const dir = this.deps.paths.dotSessions(this.dotId);
		const archive = this.deps.paths.dotArchive(this.dotId);
		await mkdir(archive, { recursive: true });
		for (const f of await readdir(dir).catch(() => [] as string[])) {
			if (f.endsWith(".jsonl")) await rename(join(dir, f), join(archive, `${Date.now()}-${f}`)).catch(() => undefined);
		}
		await this.deps.pii.destroyVault(this.dotId).catch(() => undefined);
	}

	private async disposeMain(): Promise<void> {
		this.unsub?.();
		this.unsub = undefined;
		this.session?.dispose();
		this.session = undefined;
	}

	/** Dispose sessions (idle reaper); the host stays. */
	async disposeSessions(): Promise<void> {
		if (this.isBusy) return;
		await this.disposeMain();
		for (const ls of this.linkSessions.values()) {
			ls.unsub();
			ls.session.dispose();
		}
		this.linkSessions.clear();
	}

	async dispose(): Promise<void> {
		this.disposed = true;
		this.deps.onCancelApprovals?.(this.dotId);
		try {
			await this.session?.abort();
		} catch {
			// ignore
		}
		this.emitter.abort();
		this.releaseSlot?.();
		await this.disposeMain();
		for (const ls of this.linkSessions.values()) {
			ls.unsub();
			ls.session.dispose();
		}
		this.linkSessions.clear();
	}
}

export function friendlyModelError(msg?: string): string {
	const m = msg ?? "The model returned an error.";
	if (/401|unauthori[sz]ed|invalid.*api.?key|authentication/i.test(m))
		return "The API key was rejected. Check Settings → Models.";
	if (/ECONNREFUSED|fetch failed/i.test(m)) return "Can't reach the model server. Is it running?";
	if (/429|rate.?limit/i.test(m)) return "The provider is rate-limiting requests. Try again in a moment.";
	return m.slice(0, 400);
}
