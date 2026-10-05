import { describe, expect, it, vi } from "vitest";
import {
	type EmailPayload,
	handleSignup,
	type ResendLike,
	type ResendResult,
	type SignupDeps,
} from "@/lib/early-access";

const ctx = {
	ip: "9.9.9.9",
	country: "de",
	userAgent: "Mozilla/5.0 Chrome/120.0 Safari/537.36",
	now: new Date("2026-10-05T12:34:56Z"),
};
const notFound: ResendResult = { data: null, error: { name: "not_found", message: "nope", statusCode: 404 } };
const ok: ResendResult = { data: { id: "x" }, error: null };

function setup(
	over: {
		env?: Partial<SignupDeps["env"]>;
		get?: ResendResult;
		create?: ResendResult;
		send?: ResendResult;
		limit?: SignupDeps["limit"];
	} = {},
) {
	const sent: EmailPayload[] = [];
	const get = vi.fn(async (_o: { email: string }) => over.get ?? notFound);
	const create = vi.fn(
		async (_p: { email: string; unsubscribed: boolean; segments?: { id: string }[] }) => over.create ?? ok,
	);
	const send = vi.fn(async (p: EmailPayload) => {
		sent.push(p);
		return over.send ?? ok;
	});
	const resend: ResendLike = { contacts: { get, create }, emails: { send } };
	const deps: SignupDeps = {
		limit: over.limit ?? (async () => ({ ok: true })),
		resend,
		env: {
			resendAudienceId: "seg_1",
			notifyTo: "owner@example.test",
			from: "OpenDot <onboarding@resend.dev>",
			confirmFrom: undefined,
			siteUrl: "https://opendot.live",
			...over.env,
		},
	};
	return { deps, get, create, send, sent };
}

const valid = { email: "a@example.com", t: 5000 };

describe("handleSignup", () => {
	it("saves the contact and notifies with escaped HTML", async () => {
		const s = setup();
		const r = await handleSignup({ ...valid, firstDot: "watch my inbox", mac: "intel", source: "hero" }, ctx, s.deps);
		expect(r).toEqual({ status: 200, body: { ok: true } });
		expect(s.create).toHaveBeenCalledWith({ email: "a@example.com", unsubscribed: false, segments: [{ id: "seg_1" }] });
		expect(s.sent).toHaveLength(1);
		const m = s.sent[0] as EmailPayload;
		expect(m.to).toBe("owner@example.test");
		expect(m.replyTo).toBe("a@example.com");
		expect(m.subject).toBe("New OpenDot early-access signup: a@example.com");
		expect(m.text).toContain("First Dot idea: watch my inbox");
		expect(m.html).toContain("<table");
		expect(m.html).toContain("2026-10-05 12:34 UTC");
		expect(m.html).toContain("DE");
		expect(m.html).toContain("Chrome");
	});

	it("normalises email (trim + lowercase)", async () => {
		const s = setup();
		await handleSignup({ ...valid, email: "  Foo.Bar@Example.COM " }, ctx, s.deps);
		expect(s.create.mock.calls[0]?.[0].email).toBe("foo.bar@example.com");
		expect(s.sent[0]?.replyTo).toBe("foo.bar@example.com");
	});

	it.each(["", "nope", "a@b", "a@@example.com", "a b@example.com", "@example.com", `${"a".repeat(250)}@example.com`])(
		"rejects invalid email %j",
		async (email) => {
			const s = setup();
			const r = await handleSignup({ ...valid, email }, ctx, s.deps);
			expect(r).toEqual({ status: 400, body: { ok: false, error: "invalid" } });
			expect(s.send).not.toHaveBeenCalled();
		},
	);

	it("rejects non-object input, missing t, bad mac, too-long firstDot", async () => {
		const s = setup();
		for (const bad of [
			null,
			"x",
			5,
			{ email: "a@example.com" },
			{ ...valid, mac: "arm" },
			{ ...valid, firstDot: "x".repeat(281) },
			{ ...valid, source: "other" },
		]) {
			expect((await handleSignup(bad, ctx, s.deps)).status).toBe(400);
		}
		expect((await handleSignup({ ...valid, firstDot: "x".repeat(280) }, ctx, s.deps)).status).toBe(200);
	});

	it("honeypot: pretends success, no side effects", async () => {
		const s = setup();
		const lim = vi.fn(async () => ({ ok: true }));
		s.deps.limit = lim;
		const r = await handleSignup({ ...valid, company_website: "http://spam" }, ctx, s.deps);
		expect(r).toEqual({ status: 200, body: { ok: true } });
		expect(s.get).not.toHaveBeenCalled();
		expect(s.create).not.toHaveBeenCalled();
		expect(s.send).not.toHaveBeenCalled();
		expect(lim).not.toHaveBeenCalled();
	});

	it("timing trap: t < 2500 does nothing; 2500 passes", async () => {
		const s = setup();
		expect(await handleSignup({ ...valid, t: 2499 }, ctx, s.deps)).toEqual({ status: 200, body: { ok: true } });
		expect(s.send).not.toHaveBeenCalled();
		await handleSignup({ ...valid, t: 2500 }, ctx, s.deps);
		expect(s.send).toHaveBeenCalledTimes(1);
	});

	it("rate limited -> 429 and nothing sent", async () => {
		const s = setup({ limit: async () => ({ ok: false, retryAfter: 30 }) });
		expect(await handleSignup(valid, ctx, s.deps)).toEqual({ status: 429, body: { ok: false, error: "rate" } });
		expect(s.create).not.toHaveBeenCalled();
		expect(s.send).not.toHaveBeenCalled();
	});

	it("passes the client ip to the limiter", async () => {
		const lim = vi.fn(async () => ({ ok: true }));
		const s = setup({ limit: lim });
		await handleSignup(valid, ctx, s.deps);
		expect(lim).toHaveBeenCalledWith("9.9.9.9");
	});

	it("duplicate (contact exists) -> duplicate:true, no notification", async () => {
		const s = setup({ get: ok });
		expect(await handleSignup(valid, ctx, s.deps)).toEqual({ status: 200, body: { ok: true, duplicate: true } });
		expect(s.create).not.toHaveBeenCalled();
		expect(s.send).not.toHaveBeenCalled();
	});

	it("duplicate reported by create (409 race) -> duplicate:true, no notification", async () => {
		const s = setup({
			create: { data: null, error: { name: "validation_error", message: "Contact already exists", statusCode: 409 } },
		});
		expect(await handleSignup(valid, ctx, s.deps)).toEqual({ status: 200, body: { ok: true, duplicate: true } });
		expect(s.send).not.toHaveBeenCalled();
	});

	it("contact lookup failure -> 502", async () => {
		const s = setup({
			get: { data: null, error: { name: "internal_server_error", message: "boom secret", statusCode: 500 } },
		});
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		const r = await handleSignup(valid, ctx, s.deps);
		expect(r).toEqual({ status: 502, body: { ok: false, error: "server" } });
		expect(JSON.stringify(err.mock.calls)).not.toContain("boom secret");
		err.mockRestore();
		expect(s.send).not.toHaveBeenCalled();
	});

	it("contact create failure -> 502, no notify", async () => {
		const s = setup({ create: { data: null, error: { name: "application_error", message: "x", statusCode: 500 } } });
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await handleSignup(valid, ctx, s.deps)).toEqual({ status: 502, body: { ok: false, error: "server" } });
		expect(s.send).not.toHaveBeenCalled();
	});

	it("notify failure -> 502", async () => {
		const s = setup({ send: { data: null, error: { name: "rate_limit_exceeded", message: "x", statusCode: 429 } } });
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await handleSignup(valid, ctx, s.deps)).toEqual({ status: 502, body: { ok: false, error: "server" } });
	});

	it("a thrown network error -> 502", async () => {
		const s = setup();
		s.send.mockRejectedValueOnce(new Error("socket"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await handleSignup(valid, ctx, s.deps)).status).toBe(502);
	});

	it("sends a confirmation only when EARLY_ACCESS_CONFIRM_FROM is set", async () => {
		const none = setup();
		await handleSignup(valid, ctx, none.deps);
		expect(none.sent).toHaveLength(1);

		const withConfirm = setup({ env: { confirmFrom: "OpenDot <hello@opendot.live>" } });
		await handleSignup(valid, ctx, withConfirm.deps);
		expect(withConfirm.sent).toHaveLength(2);
		const c = withConfirm.sent[1] as EmailPayload;
		expect(c.to).toBe("a@example.com");
		expect(c.from).toBe("OpenDot <hello@opendot.live>");
		expect(c.text).toContain("on the list");
		expect(c.html).toContain("OpenDot");
	});

	it("confirmation failure is logged, signup still succeeds", async () => {
		const s = setup({ env: { confirmFrom: "OpenDot <hello@opendot.live>" } });
		s.send
			.mockResolvedValueOnce(ok)
			.mockResolvedValueOnce({ data: null, error: { name: "invalid_from_address", message: "x", statusCode: 422 } });
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await handleSignup(valid, ctx, s.deps)).status).toBe(200);
	});

	it("no audience id -> skips contacts, always notifies", async () => {
		const s = setup({ env: { resendAudienceId: undefined } });
		expect((await handleSignup(valid, ctx, s.deps)).status).toBe(200);
		expect(s.get).not.toHaveBeenCalled();
		expect(s.create).not.toHaveBeenCalled();
		expect(s.sent).toHaveLength(1);
	});

	it("escapes HTML in user-supplied values", async () => {
		const s = setup();
		await handleSignup(
			{ ...valid, firstDot: `<script>alert("x")</script> & 'y'` },
			{ ...ctx, userAgent: "<b>Chrome/1</b>" },
			s.deps,
		);
		const m = s.sent[0] as EmailPayload;
		expect(m.html).not.toContain("<script>");
		expect(m.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
		expect(m.text).toContain("<script>"); // plain text is not HTML
	});
});
