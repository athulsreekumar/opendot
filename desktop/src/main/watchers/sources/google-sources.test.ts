import { describe, expect, it, vi } from "vitest";
import type { Dot, Watcher } from "../../../shared/types";
import { log } from "../../log";
import type { SourceCtx, SourceDeps } from "../types";
import { gmailSource } from "./gmail";
import { googleCalendarSource } from "./google-calendar";
import { googleDriveSource } from "./google-drive";
import { SOURCES_GOOGLE } from "./index-google";

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mkCtx<C>(
	config: C,
	handler: (url: string) => Response | Promise<Response>,
	now = "2026-10-04T12:00:00Z",
): SourceCtx<C> {
	const deps = {
		fetch: (async (url: unknown) => handler(String(url))) as unknown as typeof fetch,
		log,
		getAccessToken: vi.fn(async () => "tok"),
		now: () => new Date(now),
	} as unknown as SourceDeps;
	return {
		watcher: {} as Watcher,
		config,
		dot: {} as Dot,
		deps,
		emit: () => undefined,
		signal: new AbortController().signal,
	};
}

describe("registry", () => {
	it("exports three google sources with requires", () => {
		expect(SOURCES_GOOGLE.map((s) => s.type)).toEqual(["gmail", "google-calendar", "google-drive"]);
		expect(SOURCES_GOOGLE.map((s) => s.requires?.feature)).toEqual(["gmail", "calendar", "drive"]);
	});
});

describe("gmail source", () => {
	const meta = {
		id: "m2",
		snippet: "Please pay",
		internalDate: "1790000000000",
		payload: {
			headers: [
				{ name: "From", value: "Priya <p@x.com>" },
				{ name: "Subject", value: "Invoice" },
				{ name: "Message-ID", value: "<abc@x>" },
			],
		},
	};

	it("first run sets the cursor and emits nothing", async () => {
		const ctx = mkCtx({}, (u) => (u.endsWith("/profile") ? json(200, { historyId: "100" }) : json(500, {})));
		expect(await gmailSource.poll?.(ctx, undefined)).toEqual({ events: [], cursor: "100" });
	});

	it("second run emits the new message and advances the cursor", async () => {
		const ctx = mkCtx({}, (u) => {
			if (u.includes("/history?")) {
				expect(u).toContain("startHistoryId=100");
				return json(200, {
					history: [{ messagesAdded: [{ message: { id: "m2", labelIds: ["INBOX"] } }] }],
					historyId: "120",
				});
			}
			if (u.includes("/messages/m2")) return json(200, meta);
			return json(500, {});
		});
		const r = await gmailSource.poll?.(ctx, "100");
		expect(r?.cursor).toBe("120");
		expect(r?.events).toHaveLength(1);
		expect(r?.events[0]).toMatchObject({
			title: "Priya <p@x.com> · Invoice",
			dedupeKey: "m2",
			facts: { from: "Priya <p@x.com>", subject: "Invoice", messageId: "m2" },
		});
	});

	it("applies the query filter", async () => {
		const ctx = mkCtx({ query: "is:important" }, (u) => {
			if (u.includes("/history?"))
				return json(200, { history: [{ messagesAdded: [{ message: { id: "m2" } }] }], historyId: "121" });
			if (u.includes("/messages/m2")) return json(200, meta);
			if (u.includes("rfc822msgid")) return json(200, {});
			return json(500, {});
		});
		expect((await gmailSource.poll?.(ctx, "100"))?.events).toHaveLength(0);
	});

	it("404 resets the cursor without events", async () => {
		const ctx = mkCtx({}, (u) => (u.includes("/history?") ? json(404, {}) : json(200, { historyId: "500" })));
		expect(await gmailSource.poll?.(ctx, "1")).toEqual({ events: [], cursor: "500" });
	});
});

describe("calendar source", () => {
	const cfg = { calendarId: "primary", remindMinutes: [15] };
	const soon = {
		id: "e1",
		summary: "Design review",
		start: { dateTime: "2026-10-04T12:10:00Z" },
		end: { dateTime: "2026-10-04T13:00:00Z" },
	};

	it("first run stores a sync token and no events", async () => {
		const ctx = mkCtx(cfg, () => json(200, { items: [soon], nextSyncToken: "S1" }));
		const r = await googleCalendarSource.poll?.(ctx, undefined);
		expect(r?.events).toEqual([]);
		expect(JSON.parse(r?.cursor ?? "{}").sync).toBe("S1");
	});

	it("emits changes and a reminder only once", async () => {
		const handler = (u: string) => {
			if (u.includes("syncToken=S1"))
				return json(200, {
					items: [
						{
							id: "e2",
							summary: "New",
							status: "confirmed",
							created: "2026-10-04T11:59:50Z",
							updated: "2026-10-04T11:59:50Z",
							start: { dateTime: "2026-10-09T10:00:00Z" },
						},
					],
					nextSyncToken: "S2",
				});
			return json(200, { items: [soon] });
		};
		const r1 = await googleCalendarSource.poll?.(mkCtx(cfg, handler), JSON.stringify({ sync: "S1", reminded: {} }));
		const titles = r1?.events.map((e) => e.title);
		expect(titles).toEqual(["Event added: New", '"Design review" starts in 15 min']);
		expect(JSON.parse(r1?.cursor ?? "{}").sync).toBe("S2");

		const r2 = await googleCalendarSource.poll?.(
			mkCtx(cfg, (u) =>
				u.includes("syncToken=") ? json(200, { items: [], nextSyncToken: "S3" }) : json(200, { items: [soon] }),
			),
			r1?.cursor,
		);
		expect(r2?.events).toEqual([]);
	});

	it("reports cancelled events", async () => {
		const ctx = mkCtx(cfg, (u) =>
			u.includes("syncToken=")
				? json(200, { items: [{ id: "e3", summary: "Gone", status: "cancelled" }], nextSyncToken: "S2" })
				: json(200, { items: [] }),
		);
		const r = await googleCalendarSource.poll?.(ctx, JSON.stringify({ sync: "S1", reminded: {} }));
		expect(r?.events[0]?.title).toBe("Event cancelled: Gone");
	});
});

describe("drive source", () => {
	it("first run stores the start page token", async () => {
		const ctx = mkCtx({}, () => json(200, { startPageToken: "P1" }));
		expect(await googleDriveSource.poll?.(ctx, undefined)).toEqual({ events: [], cursor: "P1" });
	});

	it("emits changed files and follows pages", async () => {
		const ctx = mkCtx({}, (u) => {
			if (u.includes("pageToken=P1"))
				return json(200, {
					changes: [
						{
							fileId: "f1",
							file: {
								id: "f1",
								name: "Q4 plan",
								mimeType: "application/vnd.google-apps.document",
								modifiedTime: "2026-10-04T11:00:00Z",
								lastModifyingUser: { displayName: "Sam" },
							},
						},
					],
					nextPageToken: "P2",
				});
			return json(200, { changes: [{ fileId: "f2", removed: true }], newStartPageToken: "P3" });
		});
		const r = await googleDriveSource.poll?.(ctx, "P1");
		expect(r?.cursor).toBe("P3");
		expect(r?.events).toHaveLength(1);
		expect(r?.events[0]).toMatchObject({
			title: "Doc updated: Q4 plan (by Sam)",
			dedupeKey: "f1:2026-10-04T11:00:00Z",
		});
	});

	it("filters by folderId", async () => {
		const ctx = mkCtx({ folderId: "F" }, () =>
			json(200, {
				changes: [{ fileId: "f1", file: { id: "f1", name: "x", parents: ["other"] } }],
				newStartPageToken: "P9",
			}),
		);
		expect((await googleDriveSource.poll?.(ctx, "P1"))?.events).toEqual([]);
	});
});
