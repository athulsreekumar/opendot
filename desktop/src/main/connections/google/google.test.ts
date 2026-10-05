import { describe, expect, it, vi } from "vitest";
import type { NativeToolDeps } from "../native-types";
import { googleOAuthConfig } from "./config";
import { googleTools } from "./index";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function mkDeps(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => handler(String(url), init));
	const getAccessToken = vi.fn(async () => "tok");
	const deps: NativeToolDeps = {
		fetch: fetchMock as unknown as typeof fetch,
		getAccessToken,
		runJxa: async () => "",
		now: () => new Date("2026-10-04T12:00:00Z"),
	};
	return { deps, fetchMock, getAccessToken };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper calling tools generically
const run = (tools: any[], name: string, params: unknown) =>
	tools.find((t) => t.name === name).execute("id", params, undefined, undefined, undefined);

describe("google tool set", () => {
	const { deps } = mkDeps(() => json(200, {}));
	it("returns tools only for enabled features", () => {
		expect(googleTools([], deps)).toHaveLength(0);
		expect(googleTools(["gmail"], deps).map((t) => t.name)).toEqual([
			"gmail_search",
			"gmail_read",
			"gmail_create_draft",
			"gmail_send_draft",
		]);
		expect(googleTools(["calendar"], deps).map((t) => t.name)).toEqual([
			"calendar_list_events",
			"calendar_create_event",
			"calendar_update_event",
			"calendar_delete_event",
			"calendar_free_busy",
		]);
		expect(googleTools(["drive"], deps).map((t) => t.name)).toEqual([
			"drive_search",
			"drive_read",
			"drive_create_text_file",
		]);
	});
	it("sets annotations on every tool", () => {
		const all = googleTools(["gmail", "calendar", "drive"], deps);
		for (const t of all) expect(t.annotations?.openWorldHint).toBe(true);
		const by = (n: string) => all.find((t) => t.name === n)?.annotations;
		expect(by("gmail_send_draft")?.destructiveHint).toBe(true);
		expect(by("calendar_delete_event")?.destructiveHint).toBe(true);
		expect(by("gmail_search")?.readOnlyHint).toBe(true);
		expect(by("gmail_create_draft")?.destructiveHint).toBe(false);
	});
	it("builds scopes only for enabled features", () => {
		const c = googleOAuthConfig("id", "sec", ["calendar"]);
		expect(c.scopes).toEqual(["openid", "email", "https://www.googleapis.com/auth/calendar.events"]);
		expect(c.extraAuthParams).toMatchObject({
			access_type: "offline",
			prompt: "consent",
			include_granted_scopes: "true",
		});
		expect(googleOAuthConfig("id", "sec", ["gmail", "drive"]).scopes).toHaveLength(6);
	});
});

describe("gmail tools", () => {
	it("formats gmail_search as a numbered list", async () => {
		const { deps } = mkDeps((url) => {
			if (url.includes("/messages?q=")) return json(200, { messages: [{ id: "m1" }, { id: "m2" }] });
			const id = url.includes("/m1?") ? "m1" : "m2";
			return json(200, {
				id,
				payload: {
					headers: [
						{ name: "From", value: "Priya <p@x.com>" },
						{ name: "Subject", value: `Subject ${id}` },
						{ name: "Date", value: "Mon, 4 Oct 2026 10:00:00 +0000" },
					],
				},
			});
		});
		const r = await run(googleTools(["gmail"], deps), "gmail_search", { query: "is:unread" });
		expect(r.content[0].text).toBe(
			"1. Subject m1 — Priya <p@x.com> — Mon, 4 Oct 2026 10:00:00 +0000 — m1\n2. Subject m2 — Priya <p@x.com> — Mon, 4 Oct 2026 10:00:00 +0000 — m2",
		);
	});

	it("decodes text/plain and falls back to stripped html in gmail_read", async () => {
		const b64 = (s: string) => Buffer.from(s).toString("base64url");
		const plain = mkDeps(() =>
			json(200, {
				id: "m1",
				payload: {
					mimeType: "multipart/alternative",
					headers: [{ name: "Subject", value: "Hi" }],
					parts: [
						{ mimeType: "text/html", body: { data: b64("<p>html</p>") } },
						{ mimeType: "text/plain", body: { data: b64("plain body") } },
					],
				},
			}),
		);
		expect((await run(googleTools(["gmail"], plain.deps), "gmail_read", { id: "m1" })).content[0].text).toContain(
			"plain body",
		);
		const html = mkDeps(() =>
			json(200, {
				id: "m1",
				payload: { mimeType: "text/html", body: { data: b64("<div>Hello&nbsp;<b>there</b></div>") } },
			}),
		);
		expect((await run(googleTools(["gmail"], html.deps), "gmail_read", { id: "m1" })).content[0].text).toContain(
			"Hello there",
		);
	});

	it("gmail_create_draft raw decodes back to RFC 2822", async () => {
		let body: { message: { raw: string; threadId?: string } } | undefined;
		const { deps } = mkDeps((_url, init) => {
			body = JSON.parse(String(init?.body));
			return json(200, { id: "d1" });
		});
		const r = await run(googleTools(["gmail"], deps), "gmail_create_draft", {
			to: "a@b.com",
			subject: "Héllo",
			body: "Line1\nLine2",
			cc: "c@d.com",
			threadId: "t9",
		});
		expect(r.details.draftId).toBe("d1");
		expect(body?.message.threadId).toBe("t9");
		const raw = Buffer.from(body?.message.raw ?? "", "base64url").toString("utf8");
		expect(raw).toContain("To: a@b.com\r\nCc: c@d.com\r\n");
		expect(raw).toContain("Subject: =?UTF-8?B?");
		expect(raw.endsWith("\r\n\r\nLine1\nLine2")).toBe(true);
	});
});

describe("googleFetch behavior", () => {
	it("retries once on 401 with a fresh token", async () => {
		let n = 0;
		const { deps, getAccessToken } = mkDeps(() =>
			++n === 1 ? json(401, { error: { message: "expired" } }) : json(200, { files: [] }),
		);
		const r = await run(googleTools(["drive"], deps), "drive_search", { query: "plan" });
		expect(r.content[0].text).toBe("No files found.");
		expect(n).toBe(2);
		expect(getAccessToken).toHaveBeenCalledTimes(2);
	});

	it("throws readable errors", async () => {
		const { deps } = mkDeps(() => json(403, { error: { message: "Insufficient Permission" } }));
		await expect(run(googleTools(["drive"], deps), "drive_search", { query: "x" })).rejects.toThrow(
			"Google API error 403: Insufficient Permission",
		);
	});

	it("honours Retry-After once", async () => {
		let n = 0;
		const { deps } = mkDeps(() =>
			++n === 1 ? json(429, { error: { message: "slow" } }, { "Retry-After": "0.01" }) : json(200, { files: [] }),
		);
		const r = await run(googleTools(["drive"], deps), "drive_search", { query: "x" });
		expect(r.content[0].text).toBe("No files found.");
		expect(n).toBe(2);
	});
});

describe("drive and calendar tools", () => {
	it("drive_read exports Docs as text/plain", async () => {
		const urls: string[] = [];
		const { deps } = mkDeps((url) => {
			urls.push(url);
			if (url.includes("/export")) return new Response("doc text", { status: 200 });
			return json(200, { id: "f1", name: "Plan", mimeType: "application/vnd.google-apps.document" });
		});
		const r = await run(googleTools(["drive"], deps), "drive_read", { fileId: "f1" });
		expect(r.content[0].text).toContain("doc text");
		expect(urls.at(-1)).toContain("export?mimeType=text/plain");
	});

	it("calendar_list_events lists numbered events", async () => {
		const { deps } = mkDeps(() =>
			json(200, {
				items: [
					{
						id: "e1",
						summary: "Standup",
						start: { dateTime: "2026-10-05T09:00:00Z" },
						end: { dateTime: "2026-10-05T09:15:00Z" },
					},
				],
			}),
		);
		const r = await run(googleTools(["calendar"], deps), "calendar_list_events", {
			from: "2026-10-05T00:00:00Z",
			to: "2026-10-06T00:00:00Z",
		});
		expect(r.content[0].text).toBe("1. Standup — 2026-10-05T09:00:00Z to 2026-10-05T09:15:00Z — e1");
	});
});
