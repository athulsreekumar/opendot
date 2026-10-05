// Local webhook server (spec 12 §4 local-webhook): one HTTP server on 127.0.0.1 for all watchers.
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { WebhookRegistry } from "./types";

type Handler = (body: string, contentType: string) => void;

const MAX_BODY = 64 * 1024;
const MAX_PER_MIN = 60;

function safeEqual(a: string, b: string): boolean {
	const ba = Buffer.from(a);
	const bb = Buffer.from(b);
	if (ba.length !== bb.length) {
		timingSafeEqual(ba, ba);
		return false;
	}
	return timingSafeEqual(ba, bb);
}

function send(res: ServerResponse, status: number, body: Record<string, unknown>): void {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json",
		"content-length": Buffer.byteLength(text),
		connection: "close",
	});
	res.end(text);
}

export class WebhookServer implements WebhookRegistry {
	private server: Server | undefined;
	private handlers = new Map<string, Handler>();
	private hits = new Map<string, number[]>();
	private getToken: (watcherId: string) => Promise<string | undefined> = async () => undefined;
	private boundPort = 0;

	get port(): number {
		return this.boundPort;
	}

	register(watcherId: string, handler: Handler): () => void {
		this.handlers.set(watcherId, handler);
		return () => {
			if (this.handlers.get(watcherId) === handler) this.handlers.delete(watcherId);
		};
	}

	async start(port: number, getToken: (watcherId: string) => Promise<string | undefined>): Promise<void> {
		if (this.server) return;
		this.getToken = getToken;
		const server = createServer((req, res) => {
			this.handle(req, res).catch(() => {
				if (!res.headersSent) send(res, 500, { ok: false });
				else res.end();
			});
		});
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(port, "127.0.0.1", () => {
				server.off("error", reject);
				resolve();
			});
		});
		this.server = server;
		this.boundPort = (server.address() as AddressInfo).port;
	}

	async stop(): Promise<void> {
		const s = this.server;
		this.server = undefined;
		this.boundPort = 0;
		if (!s) return;
		await new Promise<void>((resolve) => {
			s.close(() => resolve());
			s.closeAllConnections();
		});
	}

	private rateLimited(watcherId: string): boolean {
		const now = Date.now();
		const arr = (this.hits.get(watcherId) ?? []).filter((t) => now - t < 60_000);
		if (arr.length >= MAX_PER_MIN) {
			this.hits.set(watcherId, arr);
			return true;
		}
		arr.push(now);
		this.hits.set(watcherId, arr);
		return false;
	}

	private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		if (req.method !== "POST") return send(res, 405, { ok: false, error: "method not allowed" });
		const m = /^\/hooks\/([^/?#]+)/.exec(req.url ?? "");
		if (!m) return send(res, 404, { ok: false, error: "not found" });
		const watcherId = decodeURIComponent(m[1] ?? "");
		const handler = this.handlers.get(watcherId);
		if (!handler) return send(res, 404, { ok: false, error: "unknown watcher" });
		const token = await this.getToken(watcherId);
		const auth = req.headers.authorization ?? "";
		const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
		if (!token || !safeEqual(given, token)) return send(res, 401, { ok: false, error: "unauthorized" });
		if (this.rateLimited(watcherId)) return send(res, 429, { ok: false, error: "rate limited" });

		const chunks: Buffer[] = [];
		let size = 0;
		let tooLarge = false;
		await new Promise<void>((resolve) => {
			req.on("data", (c: Buffer) => {
				size += c.length;
				if (size > MAX_BODY) {
					tooLarge = true;
					chunks.length = 0;
					if (size > MAX_BODY * 16) req.destroy();
				} else if (!tooLarge) chunks.push(c);
			});
			req.on("end", () => resolve());
			req.on("close", () => resolve());
			req.on("error", () => resolve());
		});
		if (tooLarge) return send(res, 413, { ok: false, error: "payload too large" });
		const body = Buffer.concat(chunks).toString("utf8");
		try {
			handler(body, String(req.headers["content-type"] ?? ""));
		} catch {
			// handler errors must never take the server down
		}
		send(res, 202, { ok: true });
	}
}
