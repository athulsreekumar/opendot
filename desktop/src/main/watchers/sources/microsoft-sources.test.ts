import { describe, expect, it, vi } from "vitest";
import type { Dot, Watcher } from "../../../shared/types";
import { log } from "../../log";
import type { NewEvent, SourceCtx, SourceDeps, WatcherSource } from "../types";
import { SOURCES_MICROSOFT } from "./index-microsoft";
import { onedriveSource } from "./onedrive";
import { outlookCalendarSource } from "./outlook-calendar";
import { outlookMailSource } from "./outlook-mail";
import { teamsChatSource } from "./teams-chat";

const G = "https://graph.microsoft.com/v1.0";
function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function ctxFor<C>(config: C, routes: (url: string) => Response, now = new Date("2026-01-01T12:00:00Z")) {
	const fetchMock = vi.fn(async (url: string | URL | Request) => routes(String(url)));
	const deps = {
		fetch: fetchMock as unknown as typeof fetch,
		log,
		getAccessToken: vi.fn(async () => "tok"),
		now: () => now,
	} as unknown as SourceDeps;
	const ctx = {
		watcher: {} as Watcher,
		config,
		dot: {} as Dot,
		deps,
		emit: () => undefined,
		signal: new AbortController().signal,
	} as SourceCtx<C>;
	return { ctx, fetchMock };
}

async function run<C>(
	src: WatcherSource<C>,
	ctx: SourceCtx<C>,
	cursor: string | undefined,
): Promise<{ events: NewEvent[]; cursor: string | undefined }> {
	return src.poll!(ctx, cursor);
}

describe("registry", () => {
	it("registers four microsoft sources with requires", () => {
		expect(SOURCES_MICROSOFT.map((s) => s.type)).toEqual([
			"outlook-mail",
			"outlook-calendar",
			"onedrive",
			"teams-chat",
		]);
		expect(SOURCES_MICROSOFT.map((s) => s.requires)).toEqual([
			{ connectionType: "microsoft", feature: "mail" },
			{ connectionType: "microsoft", feature: "calendar" },
			{ connectionType: "microsoft", feature: "onedrive" },
			{ connectionType: "microsoft", feature: "teams" },
		]);
	});
});

describe("outlook-mail", () => {
	const msg = {
		id: "M1",
		subject: "Hello",
		from: { emailAddress: { name: "Sam" } },
		receivedDateTime: "2026-01-01T11:00:00Z",
		bodyPreview: "hi there",
	};
	it("first run drains pages with no events and stores the deltaLink", async () => {
		const { ctx, fetchMock } = ctxFor({ folder: "inbox" }, (url) => {
			if (url.includes("page2")) return json({ value: [msg], "@odata.deltaLink": `${G}/delta?token=D1` });
			return json({ value: [msg], "@odata.nextLink": `${G}/delta?page2` });
		});
		const r = await run(outlookMailSource, ctx, undefined);
		expect(r.events).toEqual([]);
		expect(r.cursor).toBe(`${G}/delta?token=D1`);
		expect(fetchMock.mock.calls[0]?.[0]).toContain("/me/mailFolders/inbox/messages/delta");
	});

	it("next run emits new messages and advances the deltaLink", async () => {
		const { ctx } = ctxFor({ folder: "inbox" }, () =>
			json({
				value: [msg, { id: "M2", "@removed": { reason: "deleted" } }],
				"@odata.deltaLink": `${G}/delta?token=D2`,
			}),
		);
		const r = await run(outlookMailSource, ctx, `${G}/delta?token=D1`);
		expect(r.events).toHaveLength(1);
		expect(r.events[0]).toMatchObject({
			title: "Sam · Hello",
			dedupeKey: "M1",
			facts: { messageId: "M1", from: "Sam", subject: "Hello" },
		});
		expect(r.cursor).toBe(`${G}/delta?token=D2`);
	});

	it("410 resets silently", async () => {
		let n = 0;
		const { ctx } = ctxFor({ folder: "inbox" }, () =>
			++n === 1
				? json({ error: { message: "gone" } }, 410)
				: json({ value: [msg], "@odata.deltaLink": `${G}/delta?token=NEW` }),
		);
		const r = await run(outlookMailSource, ctx, `${G}/delta?token=OLD`);
		expect(r.events).toEqual([]);
		expect(r.cursor).toBe(`${G}/delta?token=NEW`);
	});
});

describe("onedrive", () => {
	it("first run silent, then emits changed files only", async () => {
		const file = {
			id: "F1",
			name: "plan.docx",
			lastModifiedDateTime: "2026-01-01T11:00:00Z",
			lastModifiedBy: { user: { displayName: "Sam" } },
			parentReference: { path: "/drive/root:/Docs" },
		};
		const first = ctxFor({}, () => json({ value: [file], "@odata.deltaLink": `${G}/d?t=1` }));
		const r1 = await run(onedriveSource, first.ctx, undefined);
		expect(r1).toEqual({ events: [], cursor: `${G}/d?t=1` });
		const second = ctxFor({}, () =>
			json({ value: [file, { id: "D", name: "Docs", folder: {} }], "@odata.deltaLink": `${G}/d?t=2` }),
		);
		const r2 = await run(onedriveSource, second.ctx, r1.cursor);
		expect(r2.events).toHaveLength(1);
		expect(r2.events[0]?.title).toBe("File updated: plan.docx (by Sam)");
		expect(r2.cursor).toBe(`${G}/d?t=2`);
	});
});

describe("outlook-calendar", () => {
	const now = new Date("2026-01-01T12:00:00Z");
	const soon = { id: "E1", subject: "Standup", start: { dateTime: "2026-01-01T12:10:00.0000000" } };
	const routes = (url: string) =>
		url.includes("/delta") ? json({ value: [soon], "@odata.deltaLink": `${G}/cv?t=1` }) : json({ value: [] });

	it("first run stores state silently; reminder fires once", async () => {
		const first = ctxFor({ remindMinutes: [15] }, routes, now);
		const r1 = await run(outlookCalendarSource, first.ctx, undefined);
		expect(r1.events).toEqual([]);
		const state1 = JSON.parse(r1.cursor ?? "{}");
		expect(state1.delta).toBe(`${G}/cv?t=1`);
		expect(Object.keys(state1.events)).toEqual(["E1"]);

		const second = ctxFor(
			{ remindMinutes: [15] },
			() => json({ value: [], "@odata.deltaLink": `${G}/cv?t=2` }),
			new Date("2026-01-01T12:01:00Z"),
		);
		const r2 = await run(outlookCalendarSource, second.ctx, r1.cursor);
		expect(r2.events).toHaveLength(1);
		expect(r2.events[0]?.title).toBe("Starts in 15 min: Standup");
		expect(JSON.parse(r2.cursor ?? "{}").delta).toBe(`${G}/cv?t=2`);

		const third = ctxFor(
			{ remindMinutes: [15] },
			() => json({ value: [], "@odata.deltaLink": `${G}/cv?t=3` }),
			new Date("2026-01-01T12:02:00Z"),
		);
		const r3 = await run(outlookCalendarSource, third.ctx, r2.cursor);
		expect(r3.events).toEqual([]);
	});

	it("reports added and cancelled events", async () => {
		const first = ctxFor({ remindMinutes: [] }, routes, now);
		const r1 = await run(outlookCalendarSource, first.ctx, undefined);
		const add = { id: "E2", subject: "Review", start: { dateTime: "2026-01-02T09:00:00.0000000" } };
		const second = ctxFor(
			{ remindMinutes: [] },
			() => json({ value: [add, { id: "E1", "@removed": { reason: "deleted" } }], "@odata.deltaLink": `${G}/cv?t=2` }),
			now,
		);
		const r2 = await run(outlookCalendarSource, second.ctx, r1.cursor);
		expect(r2.events.map((e) => e.title)).toEqual(["Event added: Review", "Event cancelled: Standup"]);
	});
});

describe("teams-chat", () => {
	const m = (id: string, at: string, text: string) => ({
		id,
		createdDateTime: at,
		messageType: "message",
		from: { user: { displayName: "Sam" } },
		body: { contentType: "text", content: text },
	});
	const chatA = [m("a2", "2026-01-01T10:05:00Z", "second"), m("a1", "2026-01-01T10:00:00Z", "first")];

	it("baselines per chat on first run, then emits only newer messages and tracks each chat", async () => {
		const first = ctxFor(
			{ chatIds: ["A", "B"] },
			(url) => (url.includes("/chats/A/") ? json({ value: chatA }) : json({ value: [] })),
			new Date("2026-01-01T11:00:00Z"),
		);
		const r1 = await run(teamsChatSource, first.ctx, undefined);
		expect(r1.events).toEqual([]);
		expect(JSON.parse(r1.cursor ?? "{}")).toEqual({ A: "2026-01-01T10:05:00Z", B: "2026-01-01T11:00:00.000Z" });

		const newer = [m("a3", "2026-01-01T10:10:00Z", "third"), ...chatA];
		const second = ctxFor({ chatIds: ["A", "B"] }, (url) => {
			if (url.endsWith("/chats/A")) return json({ topic: "Design" });
			if (url.includes("/chats/A/")) return json({ value: newer });
			return json({ value: [] });
		});
		const r2 = await run(teamsChatSource, second.ctx, r1.cursor);
		expect(r2.events).toHaveLength(1);
		expect(r2.events[0]?.title).toBe("Sam in Design chat: third");
		expect(r2.events[0]?.facts).toMatchObject({ chatId: "A", messageId: "a3" });
		const c2 = JSON.parse(r2.cursor ?? "{}");
		expect(c2.A).toBe("2026-01-01T10:10:00Z");
		expect(c2.B).toBe("2026-01-01T11:00:00.000Z");
	});

	it("test() needs a chat", async () => {
		const { ctx } = ctxFor({ chatIds: [] }, () => json({}));
		expect((await teamsChatSource.test(ctx)).ok).toBe(false);
	});
});
