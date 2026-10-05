import { describe, expect, it, vi } from "vitest";
import type { NativeToolDeps } from "../native-types";
import { graphFetch } from "./client";
import { fetchMicrosoftAccount, microsoftOAuthConfig } from "./config";
import { microsoftTools } from "./index";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function makeDeps(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init));
	const deps: NativeToolDeps = {
		fetch: fetchMock as unknown as typeof fetch,
		getAccessToken: vi.fn(async () => "tok"),
		runJxa: vi.fn(),
		now: () => new Date("2026-01-01T00:00:00Z"),
	};
	return { deps, fetchMock };
}

describe("microsoft config", () => {
	it("builds scopes per feature", () => {
		const c = microsoftOAuthConfig("cid", ["mail", "teams"]);
		expect(c.id).toBe("microsoft");
		expect(c.clientSecret).toBeUndefined();
		expect(c.authorizeUrl).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
		expect(c.scopes).toEqual(["offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send", "Chat.ReadWrite"]);
		expect(microsoftOAuthConfig("cid", []).scopes).toEqual(["offline_access", "User.Read"]);
	});

	it("account is mail ?? userPrincipalName", async () => {
		const f = vi.fn(async () => json({ mail: null, userPrincipalName: "a@b.com" })) as unknown as typeof fetch;
		expect(await fetchMicrosoftAccount("t", f)).toBe("a@b.com");
	});
});

describe("microsoftTools", () => {
	it("exposes tools per enabled feature with annotations", () => {
		const { deps } = makeDeps(() => json({}));
		const names = (f: string[]) => microsoftTools(f, deps).map((t) => t.name);
		expect(names(["mail"])).toEqual(["outlook_search", "outlook_read", "outlook_create_draft", "outlook_send_draft"]);
		expect(names(["calendar"])).toEqual([
			"outlook_list_events",
			"outlook_create_event",
			"outlook_update_event",
			"outlook_delete_event",
		]);
		expect(names(["onedrive"])).toEqual(["onedrive_search", "onedrive_read", "onedrive_create_text_file"]);
		expect(names(["teams"])).toEqual(["teams_list_chats", "teams_read_chat", "teams_send_chat_message"]);
		expect(names([])).toEqual([]);
		for (const t of microsoftTools(["mail", "calendar", "onedrive", "teams"], deps)) {
			expect(t.annotations, t.name).toBeDefined();
			expect(t.annotations?.openWorldHint).toBe(true);
		}
	});

	it("send/delete tools are destructive, reads are read-only", () => {
		const { deps } = makeDeps(() => json({}));
		const by = Object.fromEntries(microsoftTools(["mail", "calendar", "teams"], deps).map((t) => [t.name, t]));
		for (const n of ["outlook_send_draft", "outlook_delete_event", "teams_send_chat_message"]) {
			expect(by[n]?.annotations?.destructiveHint).toBe(true);
		}
		expect(by.outlook_create_draft?.annotations?.destructiveHint).toBe(false);
		expect(by.outlook_search?.annotations?.readOnlyHint).toBe(true);
	});

	it("outlook_search sends $search with quotes + ConsistencyLevel and formats results", async () => {
		const { deps, fetchMock } = makeDeps(() =>
			json({
				value: [
					{
						id: "AAA",
						subject: "Budget Q4",
						from: { emailAddress: { name: "Sam", address: "sam@x.com" } },
						receivedDateTime: "2026-01-02T10:00:00Z",
					},
					{
						id: "BBB",
						subject: "Lunch?",
						from: { emailAddress: { address: "kim@x.com" } },
						receivedDateTime: "2026-01-03T10:00:00Z",
					},
				],
			}),
		);
		const tool = microsoftTools(["mail"], deps).find((t) => t.name === "outlook_search");
		// biome-ignore lint/suspicious/noExplicitAny: test call
		const res = await (tool as any).execute("c1", { query: "budget", top: 5 });
		expect(res.content[0].text).toBe(
			"1. Budget Q4 — Sam — 2026-01-02T10:00:00Z — AAA\n2. Lunch? — kim@x.com — 2026-01-03T10:00:00Z — BBB",
		);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(decodeURIComponent(url)).toContain('/me/messages?$search="budget"&$top=5');
		expect(new Headers(init.headers).get("ConsistencyLevel")).toBe("eventual");
		expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
	});

	it("outlook_send_draft POSTs to /send", async () => {
		const { deps, fetchMock } = makeDeps(() => new Response(null, { status: 202 }));
		const tool = microsoftTools(["mail"], deps).find((t) => t.name === "outlook_send_draft");
		// biome-ignore lint/suspicious/noExplicitAny: test call
		await (tool as any).execute("c1", { id: "D1" });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://graph.microsoft.com/v1.0/me/messages/D1/send");
		expect(init.method).toBe("POST");
	});

	it("onedrive_read refuses files over 1 MB", async () => {
		const { deps } = makeDeps(() => json({ id: "F", name: "big.txt", size: 5_000_000 }));
		const tool = microsoftTools(["onedrive"], deps).find((t) => t.name === "onedrive_read");
		// biome-ignore lint/suspicious/noExplicitAny: test call
		await expect((tool as any).execute("c1", { itemId: "F" })).rejects.toThrow(/larger than 1 MB/);
	});
});

describe("graphFetch", () => {
	it("retries once on 401 with a fresh token", async () => {
		let n = 0;
		const { deps, fetchMock } = makeDeps(() =>
			++n === 1 ? json({ error: { message: "expired" } }, 401) : json({ ok: true }),
		);
		const res = await graphFetch(deps, "/me");
		expect(res.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(deps.getAccessToken).toHaveBeenCalledTimes(2);
	});

	it("gives up after a second 401 with a readable error", async () => {
		const { deps } = makeDeps(() => json({ error: { message: "nope" } }, 401));
		await expect(graphFetch(deps, "/me")).rejects.toThrow("Microsoft Graph error 401: nope");
	});

	it("retries 429 once honouring Retry-After", async () => {
		let n = 0;
		const { deps, fetchMock } = makeDeps(() => (++n === 1 ? json({}, 429, { "Retry-After": "0" }) : json({ ok: 1 })));
		await graphFetch(deps, "/me");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not wait for Retry-After > 10 s", async () => {
		const { deps, fetchMock } = makeDeps(() => json({ error: { message: "slow down" } }, 429, { "Retry-After": "60" }));
		await expect(graphFetch(deps, "/me")).rejects.toThrow("Microsoft Graph error 429: slow down");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("formats 403 errors", async () => {
		const { deps } = makeDeps(() => json({ error: { code: "ErrorAccessDenied", message: "Access is denied." } }, 403));
		await expect(graphFetch(deps, "/me/messages")).rejects.toThrow("Microsoft Graph error 403: Access is denied.");
	});
});
