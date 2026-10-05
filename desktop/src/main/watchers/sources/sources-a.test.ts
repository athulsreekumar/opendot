import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Dot, Watcher } from "../../../shared/types";
import { log } from "../../log";
import type { NewEvent, SourceCtx, SourceDeps, WebhookRegistry } from "../types";
import { WebhookServer } from "../webhook-server";
import { folderSource } from "./folder";
import { SOURCES_A } from "./index-a";
import { localWebhookSource } from "./local-webhook";
import { rssSource } from "./rss";
import { parseFeed } from "./rss-parse";
import { nextFire, type ScheduleConfig, scheduleSource } from "./schedule";
import { urlSource } from "./url";

function makeCtx<C>(
	config: C,
	over: {
		now?: () => Date;
		fetch?: typeof fetch;
		webhooks?: WebhookRegistry;
		id?: string;
		emit?: (e: NewEvent) => void;
	} = {},
): SourceCtx<C> {
	const deps: SourceDeps = {
		fetch: over.fetch ?? (async () => new Response("")),
		log,
		getAccessToken: async () => {
			throw new Error("no token");
		},
		runJxa: async () => {
			throw new Error("no jxa");
		},
		mcpClient: async () => {
			throw new Error("no mcp");
		},
		webhooks: over.webhooks ?? { register: () => () => undefined },
		now: over.now ?? (() => new Date()),
	};
	return {
		watcher: { id: over.id ?? "w1", label: "Morning briefing", type: "schedule" } as unknown as Watcher,
		config,
		dot: {} as Dot,
		deps,
		emit: over.emit ?? (() => undefined),
		signal: new AbortController().signal,
	};
}

describe("index-a", () => {
	it("exports five sources", () => {
		expect(SOURCES_A.map((s) => s.type)).toEqual(["schedule", "folder", "url", "rss", "local-webhook"]);
	});
});

describe("nextFire", () => {
	it("daily picks the next time today or tomorrow", () => {
		const cfg: ScheduleConfig = { mode: "daily", times: ["09:00", "18:00"], timeZone: "UTC" };
		expect(nextFire(cfg, new Date("2026-01-15T08:00:00Z")).toISOString()).toBe("2026-01-15T09:00:00.000Z");
		expect(nextFire(cfg, new Date("2026-01-15T09:00:00Z")).toISOString()).toBe("2026-01-15T18:00:00.000Z");
		expect(nextFire(cfg, new Date("2026-01-15T19:00:00Z")).toISOString()).toBe("2026-01-16T09:00:00.000Z");
	});
	it("weekly honours the days list", () => {
		const cfg: ScheduleConfig = { mode: "weekly", days: [1], times: ["08:00"], timeZone: "UTC" };
		// 2026-01-15 is a Thursday; next Monday is the 19th.
		expect(nextFire(cfg, new Date("2026-01-15T12:00:00Z")).toISOString()).toBe("2026-01-19T08:00:00.000Z");
	});
	it("every aligns to the minute", () => {
		const cfg: ScheduleConfig = { mode: "every", everyMin: 30, timeZone: "UTC" };
		expect(nextFire(cfg, new Date("2026-01-15T12:00:45Z")).toISOString()).toBe("2026-01-15T12:30:00.000Z");
	});
	it("handles time zones", () => {
		const ny: ScheduleConfig = { mode: "daily", times: ["09:00"], timeZone: "America/New_York" };
		expect(nextFire(ny, new Date("2026-01-15T12:00:00Z")).toISOString()).toBe("2026-01-15T14:00:00.000Z");
		const summer = nextFire(ny, new Date("2026-07-15T12:00:00Z")).toISOString();
		expect(summer).toBe("2026-07-15T13:00:00.000Z");
		const in_: ScheduleConfig = { mode: "daily", times: ["09:00"], timeZone: "Asia/Kolkata" };
		expect(nextFire(in_, new Date("2026-01-15T00:00:00Z")).toISOString()).toBe("2026-01-15T03:30:00.000Z");
	});
	it("local means the system zone", () => {
		const cfg: ScheduleConfig = { mode: "daily", times: ["09:00"], timeZone: "local" };
		const n = nextFire(cfg, new Date());
		expect(n.getTime()).toBeGreaterThan(Date.now());
	});
});

describe("schedule source", () => {
	const cfg: ScheduleConfig = { mode: "daily", times: ["09:00"], timeZone: "UTC" };
	it("first run emits nothing, then fires once", async () => {
		let now = new Date("2026-01-15T08:00:00Z");
		const ctx = makeCtx(cfg, { now: () => now });
		const first = await scheduleSource.poll?.(ctx, undefined);
		expect(first?.events).toHaveLength(0);
		expect(first?.cursor).toBe("2026-01-15T09:00:00.000Z");
		now = new Date("2026-01-15T08:59:00Z");
		const early = await scheduleSource.poll?.(ctx, first?.cursor);
		expect(early?.events).toHaveLength(0);
		now = new Date("2026-01-15T09:00:20Z");
		const fired = await scheduleSource.poll?.(ctx, early?.cursor);
		expect(fired?.events).toHaveLength(1);
		expect(fired?.events[0]?.title).toBe("Scheduled: Morning briefing");
		expect(fired?.events[0]?.dedupeKey).toBe("2026-01-15T09:00:00.000Z");
		expect(fired?.cursor).toBe("2026-01-16T09:00:00.000Z");
		const again = await scheduleSource.poll?.(ctx, fired?.cursor);
		expect(again?.events).toHaveLength(0);
	});
	it("skips a fire more than 6 h late", async () => {
		const ctx = makeCtx(cfg, { now: () => new Date("2026-01-15T16:00:00Z") });
		const r = await scheduleSource.poll?.(ctx, "2026-01-15T09:00:00.000Z");
		expect(r?.events).toHaveLength(0);
		expect(r?.cursor).toBe("2026-01-16T09:00:00.000Z");
	});
});

describe("folder source", () => {
	let dir = "";
	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
	});
	it("detects a created file", async () => {
		dir = mkdtempSync(join(tmpdir(), "opendot-folder-"));
		const events: NewEvent[] = [];
		const ctx = makeCtx(
			{ path: dir, recursive: false, events: ["created" as const], include: ["*.pdf"] },
			{ emit: (e) => events.push(e) },
		);
		const stop = await folderSource.start?.(ctx);
		writeFileSync(join(dir, "ignored.txt"), "x");
		writeFileSync(join(dir, ".hidden.pdf"), "x");
		writeFileSync(join(dir, "acme-oct.pdf"), "hello");
		const deadline = Date.now() + 5000;
		while (events.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
		await stop?.();
		expect(events).toHaveLength(1);
		expect(events[0]!.title).toMatch(/^New file acme-oct\.pdf in opendot-folder-/);
		expect(events[0]!.facts.path).toBe(join(dir, "acme-oct.pdf"));
		expect(events[0]!.facts.size).toBe("5");
	});
	it("test() lists samples", async () => {
		dir = mkdtempSync(join(tmpdir(), "opendot-folder-"));
		writeFileSync(join(dir, "a.txt"), "a");
		writeFileSync(join(dir, "b.txt"), "b");
		const r = await folderSource.test(makeCtx({ path: dir, recursive: false, events: ["created" as const] }));
		expect(r.ok).toBe(true);
		expect(r.sample).toHaveLength(2);
		const bad = await folderSource.test(
			makeCtx({ path: join(dir, "nope"), recursive: false, events: ["created" as const] }),
		);
		expect(bad.ok).toBe(false);
	});
});

describe("url source", () => {
	it("stores first, emits a diff on change", async () => {
		let html =
			"<html><head><title>Pricing</title><style>a{}</style></head><body><script>x()</script><p>Basic $5</p></body></html>";
		const f = (async () => new Response(html)) as unknown as typeof fetch;
		const ctx = makeCtx({ url: "https://example.com/p" }, { fetch: f });
		const first = await urlSource.poll?.(ctx, undefined);
		expect(first?.events).toHaveLength(0);
		const same = await urlSource.poll?.(ctx, first?.cursor);
		expect(same?.events).toHaveLength(0);
		html = html.replace("<p>Basic $5</p>", "<p>Basic $5</p><p>Pro $9</p>");
		const changed = await urlSource.poll?.(ctx, first?.cursor);
		expect(changed?.events).toHaveLength(1);
		expect(changed?.events[0]?.title).toBe("Page changed: Pricing");
		expect(changed?.events[0]?.body).toContain("+ Pro $9");
		expect(changed?.events[0]?.body).not.toContain("Basic");
	});
	it("rejects non-https urls", () => {
		expect(urlSource.configSchema.safeParse({ url: "http://example.com" }).success).toBe(false);
		expect(urlSource.configSchema.safeParse({ url: "http://localhost:8080/x" }).success).toBe(true);
	});
});

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>
<item><title>Second &amp; best</title><link>https://ex.com/2</link><guid>g2</guid><description><![CDATA[<p>Hello <b>world</b></p>]]></description><pubDate>Tue, 06 Jan 2026 10:00:00 GMT</pubDate></item>
<item><title>First</title><link>https://ex.com/1</link><description>It&#39;s &lt;b&gt;ok&lt;/b&gt;</description></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title>Entry One</title><id>urn:1</id><link rel="alternate" href="https://ex.com/a1"/><link rel="self" href="https://ex.com/self"/><summary>Sum &quot;one&quot;</summary><updated>2026-01-05T10:00:00Z</updated></entry>
<entry><title type="html">Entry Two</title><id>urn:2</id><link href="https://ex.com/a2"/><content type="html">&lt;p&gt;Body&lt;/p&gt;</content></entry></feed>`;

describe("rss", () => {
	it("parses RSS 2.0", () => {
		const items = parseFeed(RSS);
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			id: "g2",
			title: "Second & best",
			link: "https://ex.com/2",
			summary: "Hello world",
		});
		expect(items[0]!.published).toBe("Tue, 06 Jan 2026 10:00:00 GMT");
		expect(items[1]!.id).toBe("https://ex.com/1");
		expect(items[1]!.summary).toBe("It's ok");
	});
	it("parses Atom", () => {
		const items = parseFeed(ATOM);
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			id: "urn:1",
			title: "Entry One",
			link: "https://ex.com/a1",
			summary: 'Sum "one"',
		});
		expect(items[0]!.published).toBe("2026-01-05T10:00:00Z");
		expect(items[1]).toMatchObject({ id: "urn:2", link: "https://ex.com/a2", summary: "Body" });
	});
	it("detects new items after the first run", async () => {
		let xml = RSS;
		const f = (async () => new Response(xml)) as unknown as typeof fetch;
		const ctx = makeCtx({ url: "https://ex.com/feed" }, { fetch: f });
		const first = await rssSource.poll?.(ctx, undefined);
		expect(first?.events).toHaveLength(0);
		expect(JSON.parse(first?.cursor ?? "[]")).toEqual(["g2", "https://ex.com/1"]);
		xml = RSS.replace(
			"<channel><title>Blog</title>",
			"<channel><title>Blog</title><item><title>Third</title><guid>g3</guid><link>https://ex.com/3</link><description>new</description></item>",
		);
		const next = await rssSource.poll?.(ctx, first?.cursor);
		expect(next?.events).toHaveLength(1);
		expect(next?.events[0]?.title).toBe("Third");
		expect(next?.events[0]?.facts.link).toBe("https://ex.com/3");
		const none = await rssSource.poll?.(ctx, next?.cursor);
		expect(none?.events).toHaveLength(0);
	});
});

describe("webhook server + local-webhook source", () => {
	let server = new WebhookServer();
	beforeEach(() => {
		server = new WebhookServer();
	});
	afterEach(async () => {
		await server.stop();
	});
	const TOKEN = "s3cret-token";
	const post = (path: string, body: string, token: string | null = TOKEN) =>
		fetch(`http://127.0.0.1:${server.port}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
			body,
		});

	it("responds with 202/401/404/405/413 and emits events", async () => {
		await server.start(0, async (id) => (id === "w1" ? TOKEN : undefined));
		expect(server.port).toBeGreaterThan(0);
		const events: NewEvent[] = [];
		const stop = await localWebhookSource.start?.(makeCtx({}, { webhooks: server, emit: (e) => events.push(e) }));

		const ok = await post("/hooks/w1", JSON.stringify({ title: "Deploy done", importance: "high", n: 1 }));
		expect(ok.status).toBe(202);
		expect(await ok.json()).toEqual({ ok: true });
		expect(events).toHaveLength(1);
		expect(events[0]!.title).toBe("Deploy done");
		expect(events[0]!.importanceHint).toBe("high");
		expect(events[0]!.body).toContain('"n": 1');

		const text = await fetch(`http://127.0.0.1:${server.port}/hooks/w1`, {
			method: "POST",
			headers: { authorization: `Bearer ${TOKEN}`, "content-type": "text/plain" },
			body: "line one\nline two",
		});
		expect(text.status).toBe(202);
		expect(events[1]!.title).toBe("line one");
		expect(events[1]!.body).toBe("line one\nline two");

		expect((await post("/hooks/w1", "{}", "wrong")).status).toBe(401);
		expect((await post("/hooks/w1", "{}", null)).status).toBe(401);
		expect((await post("/hooks/nope", "{}")).status).toBe(404);
		expect((await fetch(`http://127.0.0.1:${server.port}/hooks/w1`)).status).toBe(405);
		expect((await post("/hooks/w1", "x".repeat(70 * 1024))).status).toBe(413);
		expect(events).toHaveLength(2);

		await stop?.();
		expect((await post("/hooks/w1", "{}")).status).toBe(404);
	});

	it("rate limits at 60 requests per minute", async () => {
		await server.start(0, async () => TOKEN);
		server.register("w1", () => undefined);
		const statuses: number[] = [];
		for (let i = 0; i < 62; i++) statuses.push((await post("/hooks/w1", "{}")).status);
		expect(statuses.filter((s) => s === 202)).toHaveLength(60);
		expect(statuses.slice(60)).toEqual([429, 429]);
	});
});
