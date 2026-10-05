// mcp-resource (subscribe, fallback poll) and mcp-poll (read-only tool result changes) — spec 12 §4.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function lineDiff(prev: string, next: string, max = 1500): string {
	const old = new Set(prev.split("\n").map((l) => l.trim()));
	const added = next
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !old.has(l))
		.map((l) => `+ ${l}`)
		.join("\n");
	return (added || next).slice(0, max);
}

const ResourceConfig = z.object({ connectionId: z.string().min(1), uri: z.string().min(1) });
type ResourceConfig = z.infer<typeof ResourceConfig>;

async function readText(ctx: SourceCtx<ResourceConfig>): Promise<string> {
	const client = await ctx.deps.mcpClient(ctx.config.connectionId);
	try {
		const r = await client.readResource(ctx.config.uri);
		return r.contents
			.map((c) => c.text ?? "")
			.join("\n")
			.slice(0, 20000);
	} finally {
		await client.close().catch(() => undefined);
	}
}

export const mcpResourceSource: WatcherSource<ResourceConfig> = {
	type: "mcp-resource",
	label: "MCP resource",
	configSchema: ResourceConfig,
	defaultIntervalSec: 60,
	minIntervalSec: 30,
	async poll(ctx, cursor) {
		const text = await readText(ctx);
		const hash = sha(text);
		const prev = cursor ? (JSON.parse(cursor) as { hash: string; text: string }) : undefined;
		const next = JSON.stringify({ hash, text: text.slice(0, 20000) });
		if (!prev || prev.hash === hash) return { events: [], cursor: next };
		const ev: NewEvent = {
			title: `Resource updated: ${ctx.config.uri}`.slice(0, 140),
			body: lineDiff(prev.text, text),
			facts: { uri: ctx.config.uri },
			dedupeKey: `${ctx.config.uri}:${hash}`,
			importanceHint: "normal",
			occurredAt: ctx.deps.now().toISOString(),
		};
		return { events: [ev], cursor: next };
	},
	async start(ctx) {
		const client = await ctx.deps.mcpClient(ctx.config.connectionId);
		if (!client.capabilities()?.resources?.subscribe) {
			await client.close().catch(() => undefined);
			return async () => undefined; // poll() covers it
		}
		await client.request("resources/subscribe", { uri: ctx.config.uri });
		let last = "";
		const off = client.onNotification("notifications/resources/updated", (params) => {
			const uri = (params as { uri?: string } | undefined)?.uri;
			if (uri && uri !== ctx.config.uri) return;
			void client.readResource(ctx.config.uri).then((r) => {
				const text = r.contents.map((c) => c.text ?? "").join("\n");
				const hash = sha(text);
				if (hash === last) return;
				ctx.emit({
					title: `Resource updated: ${ctx.config.uri}`.slice(0, 140),
					body: lineDiff(last ? text : "", text),
					facts: { uri: ctx.config.uri },
					dedupeKey: `${ctx.config.uri}:${hash}`,
					importanceHint: "normal",
					occurredAt: ctx.deps.now().toISOString(),
				});
				last = hash;
			});
		});
		return async () => {
			off();
			await client.close().catch(() => undefined);
		};
	},
	async test(ctx) {
		try {
			const text = await readText(ctx);
			return { ok: true, message: `Read ${text.length} characters.`, sample: [] };
		} catch (e) {
			return { ok: false, message: (e as Error).message, sample: [] };
		}
	},
};

const PollConfig = z.object({
	connectionId: z.string().min(1),
	tool: z.string().min(1),
	args: z.string().default("{}"),
	confirmedReadOnly: z.boolean().optional(),
});
type PollConfig = z.infer<typeof PollConfig>;

async function callOnce(ctx: SourceCtx<PollConfig>): Promise<string> {
	const client = await ctx.deps.mcpClient(ctx.config.connectionId);
	try {
		const tools =
			(
				await client.request<{ tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> }>(
					"tools/list",
					{},
				)
			).tools ?? [];
		const t = tools.find((x) => x.name === ctx.config.tool);
		if (!t) throw new Error(`Tool ${ctx.config.tool} not found on this server.`);
		if (t.annotations?.readOnlyHint !== true && !ctx.config.confirmedReadOnly) {
			throw new Error("This tool isn't marked read-only. Confirm it only reads data to poll it.");
		}
		const res = await client.callTool(ctx.config.tool, JSON.parse(ctx.config.args || "{}") as Record<string, unknown>);
		if (res.isError)
			throw new Error(
				(res.content ?? [])
					.map((c) => c.text ?? "")
					.join(" ")
					.slice(0, 300) || "Tool error",
			);
		return (res.content ?? [])
			.map((c) => c.text ?? "")
			.join("\n")
			.slice(0, 20000);
	} finally {
		await client.close().catch(() => undefined);
	}
}

export const mcpPollSource: WatcherSource<PollConfig> = {
	type: "mcp-poll",
	label: "MCP tool result",
	configSchema: PollConfig,
	defaultIntervalSec: 120,
	minIntervalSec: 30,
	async poll(ctx, cursor) {
		const text = await callOnce(ctx);
		const hash = sha(text);
		const prev = cursor ? (JSON.parse(cursor) as { hash: string; text: string }) : undefined;
		const next = JSON.stringify({ hash, text });
		if (!prev || prev.hash === hash) return { events: [], cursor: next };
		return {
			events: [
				{
					title: `${ctx.config.tool} result changed`,
					body: lineDiff(prev.text, text),
					facts: { tool: ctx.config.tool },
					dedupeKey: `${ctx.config.tool}:${hash}`,
					importanceHint: "normal",
					occurredAt: ctx.deps.now().toISOString(),
				},
			],
			cursor: next,
		};
	},
	async test(ctx) {
		try {
			const text = await callOnce(ctx);
			return { ok: true, message: `Tool returned ${text.length} characters.`, sample: [] };
		} catch (e) {
			return { ok: false, message: (e as Error).message, sample: [] };
		}
	},
};
