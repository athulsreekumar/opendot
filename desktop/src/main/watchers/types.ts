// Watcher source contract (spec 12 §2.1). Sources live in ./sources/<type>.ts and are registered in ./sources/index.ts.
import type { z } from "zod";
import type { ConnectionType, Dot, DotEvent, Watcher, WatcherType } from "../../shared/types";
import type { Logger } from "../log";

export type NewEvent = Omit<DotEvent, "id" | "dotId" | "watcherId" | "type" | "receivedAt" | "status">;

/** What a source may use. Everything network-ish is injected so tests can stub it. */
export interface SourceDeps {
	fetch: typeof fetch;
	log: Logger;
	/** OAuth access token for a native connector ("google" | "microsoft"); throws NeedsAuthError when not signed in. */
	getAccessToken(type: "google" | "microsoft"): Promise<string>;
	/** Run JXA (osascript -l JavaScript) and return stdout. Mac only. */
	runJxa(script: string, timeoutMs?: number): Promise<string>;
	/** Resolve an installed MCP connection to a connected McpClient-like object. */
	mcpClient(connectionId: string): Promise<McpLikeClient>;
	/** Local webhook registry (local-webhook source). */
	webhooks: WebhookRegistry;
	now(): Date;
}

export interface McpLikeClient {
	request<R = unknown>(method: string, params?: Record<string, unknown>): Promise<R>;
	onNotification(method: string, listener: (params: unknown) => void): () => void;
	readResource(
		uri: string,
	): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }>;
	callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<{ content?: Array<{ type: string; text?: string }>; isError?: boolean }>;
	capabilities(): { resources?: { subscribe?: boolean } } | undefined;
	close(): Promise<void>;
}

export interface WebhookRegistry {
	/** Register a handler for POST /hooks/<watcherId>. Returns unregister. */
	register(watcherId: string, handler: (body: string, contentType: string) => void): () => void;
}

export class NeedsAuthError extends Error {
	constructor(message = "Sign in required") {
		super(message);
		this.name = "NeedsAuthError";
	}
}

export interface SourceCtx<C> {
	watcher: Watcher;
	config: C;
	dot: Dot;
	deps: SourceDeps;
	emit(e: NewEvent): void;
	signal: AbortSignal;
}

export interface WatcherSource<C = Record<string, unknown>> {
	type: WatcherType;
	label: string;
	requires?: { connectionType: ConnectionType; feature?: string };
	configSchema: z.ZodType<C>;
	defaultIntervalSec: number;
	minIntervalSec: number;
	/** Polling: fetch items since cursor. First run (cursor undefined): set the cursor to "now" and return NO events. */
	poll?(ctx: SourceCtx<C>, cursor: string | undefined): Promise<{ events: NewEvent[]; cursor: string | undefined }>;
	/** Push: start listening, call ctx.emit, return a stop function. */
	start?(ctx: SourceCtx<C>): Promise<() => Promise<void>>;
	/** Validate config + credentials; return up to 3 sample items without advancing any cursor. */
	test(ctx: SourceCtx<C>): Promise<{ ok: boolean; message: string; sample: NewEvent[] }>;
}
