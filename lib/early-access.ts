import { z } from "zod";
import type { ServerEnv } from "@/lib/env";
import type { LimitResult } from "@/lib/rate-limit";

/**
 * Early-access signup core (PLAN §8). Pure and dependency-injected; the route is a thin wrapper.
 *
 * Resend contacts API (installed SDK resend@6.32.0, checked against node_modules/resend/dist/index.d.mts):
 *  - Audiences have been replaced by global Contacts + Segments. `contacts.create({ audienceId })` still type-checks
 *    but is `@deprecated` (it posts to /audiences/:id/contacts). The current form is
 *    `contacts.create({ email, unsubscribed, segments: [{ id }] })`, so RESEND_AUDIENCE_ID is used as the segment id
 *    (an old Audience id is the same id as its segment after Resend's migration).
 *  - The SDK does NOT throw for API errors: every call resolves `{ data, error, headers }` with
 *    `error = { name, message, statusCode } | null`.
 *  - Duplicate detection: `contacts.get({ email })` (GET /contacts/:email, global lookup by email) runs first.
 *    `data` => already on the list (duplicate, no notification). `error.name === "not_found"` (404) => new contact.
 *    Any other error => server error. If the contact was created concurrently, `create` may return 409 /
 *    "already exists"; that is also treated as a duplicate.
 */

export type ResendError = { name?: string; message?: string; statusCode?: number | null };
export type ResendResult<T = unknown> = { data: T | null; error: ResendError | null };

export type EmailPayload = {
	from: string;
	to: string | string[];
	subject: string;
	text: string;
	html: string;
	replyTo?: string;
};

export type ResendLike = {
	contacts: {
		get(options: { email: string }): Promise<ResendResult>;
		create(payload: { email: string; unsubscribed: boolean; segments?: { id: string }[] }): Promise<ResendResult>;
	};
	emails: { send(payload: EmailPayload): Promise<ResendResult> };
};

export type SignupContext = { ip: string; country?: string; userAgent?: string; now: Date };
export type SignupDeps = {
	limit: (ip: string) => Promise<LimitResult>;
	resend: ResendLike;
	env: Pick<ServerEnv, "resendAudienceId" | "notifyTo" | "from" | "confirmFrom" | "siteUrl">;
};
export type SignupResponse = {
	status: 200 | 400 | 429 | 502;
	body: { ok: boolean; duplicate?: true; error?: "invalid" | "rate" | "server" };
};

export const MIN_FILL_MS = 2500;

const emailSchema = z.string().trim().toLowerCase().pipe(z.string().min(3).max(254).pipe(z.email()));

export const signupSchema = z.object({
	email: emailSchema,
	firstDot: z
		.string()
		.trim()
		.max(280)
		.optional()
		.transform((v) => (v ? v : undefined)),
	mac: z.enum(["apple-silicon", "intel", "unsure"]).optional(),
	company_website: z.string().optional(),
	t: z.number().finite(),
	source: z.enum(["hero", "nav", "final", "section"]).optional(),
});

export type Signup = z.infer<typeof signupSchema>;

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function browserFamily(ua?: string): string {
	if (!ua) return "unknown";
	if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
	if (/OPR\/|Opera/.test(ua)) return "Opera";
	if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
	if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
	if (/Safari\//.test(ua)) return "Safari";
	return "other";
}

const MAC_LABEL: Record<string, string> = { "apple-silicon": "Apple silicon", intel: "Intel", unsure: "Not sure" };

function formatUtc(d: Date): string {
	return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function buildNotification(signup: Signup, ctx: SignupContext) {
	const rows: [string, string][] = [
		["Email", signup.email],
		["First Dot idea", signup.firstDot ?? "-"],
		["Mac", signup.mac ? (MAC_LABEL[signup.mac] ?? signup.mac) : "-"],
		["Source", signup.source ?? "-"],
		["Time", formatUtc(ctx.now)],
		["Country", ctx.country ? ctx.country.slice(0, 2).toUpperCase() : "-"],
		["Browser", browserFamily(ctx.userAgent)],
	];
	const text = `New OpenDot early-access signup\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`;
	const tr = rows
		.map(
			([k, v]) =>
				`<tr><td style="padding:8px 16px 8px 0;color:#6b6b76;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:8px 0;color:#111;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
		)
		.join("");
	const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px"><h2 style="margin:0 0 16px;font-size:18px">New OpenDot early-access signup</h2><table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e5e5ea">${tr}</table></div>`;
	return { subject: `New OpenDot early-access signup: ${signup.email}`, text, html };
}

export function buildConfirmation(siteUrl: string) {
	const text = `You're on the list.\n\nThanks for your interest in OpenDot, the AI assistants (Dots) that live on your Mac. We'll email you the moment early access opens, and only about OpenDot.\n\nNothing to do in the meantime. If you'd rather not hear from us, just reply to this email and we'll remove you.\n\nThe OpenDot team\n${siteUrl}\n`;
	const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#111;max-width:520px"><p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b6b76">OpenDot</p><h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;letter-spacing:-.02em">You're on the list.</h1><p style="margin:0 0 16px">Thanks for your interest in OpenDot, the AI assistants (Dots) that live on your Mac. We'll email you the moment early access opens, and only about OpenDot.</p><p style="margin:0 0 24px">Nothing to do in the meantime. If you'd rather not hear from us, just reply to this email and we'll remove you.</p><p style="margin:0;color:#6b6b76">The OpenDot team<br><a href="${escapeHtml(siteUrl)}" style="color:#6b6b76">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a></p></div>`;
	return { subject: "You're on the OpenDot early-access list", text, html };
}

const OK: SignupResponse = { status: 200, body: { ok: true } };
const SERVER: SignupResponse = { status: 502, body: { ok: false, error: "server" } };

function isNotFound(e: ResendError): boolean {
	return e.statusCode === 404 || e.name === "not_found";
}
function isAlreadyExists(e: ResendError): boolean {
	return e.statusCode === 409 || /already exist/i.test(e.message ?? "");
}

function logFailure(step: string, e: ResendError | unknown) {
	// Only non-sensitive fields: never the API key, email address or message body.
	const err = (e ?? {}) as ResendError;
	console.error(`[early-access] ${step} failed`, { name: err.name, statusCode: err.statusCode });
}

export async function handleSignup(input: unknown, ctx: SignupContext, deps: SignupDeps): Promise<SignupResponse> {
	// 1. validate
	const parsed = signupSchema.safeParse(input);
	if (!parsed.success) return { status: 400, body: { ok: false, error: "invalid" } };
	const signup = parsed.data;

	// 2. bots: pretend success, do nothing
	if (signup.company_website || signup.t < MIN_FILL_MS) return OK;

	// 3. rate limit
	const rl = await deps.limit(ctx.ip);
	if (!rl.ok) return { status: 429, body: { ok: false, error: "rate" } };

	const { resend, env } = deps;
	try {
		// 4. save contact (skipped without an audience/segment id; duplicates cannot be detected then)
		if (env.resendAudienceId) {
			const existing = await resend.contacts.get({ email: signup.email });
			if (existing.data && !existing.error) return { status: 200, body: { ok: true, duplicate: true } };
			if (existing.error && !isNotFound(existing.error)) {
				logFailure("contacts.get", existing.error);
				return SERVER;
			}
			const created = await resend.contacts.create({
				email: signup.email,
				unsubscribed: false,
				segments: [{ id: env.resendAudienceId }],
			});
			if (created.error) {
				if (isAlreadyExists(created.error)) return { status: 200, body: { ok: true, duplicate: true } };
				logFailure("contacts.create", created.error);
				return SERVER;
			}
		}

		// 5. notify owner
		if (!env.notifyTo) {
			console.error("[early-access] EARLY_ACCESS_NOTIFY_TO is not set");
			return SERVER;
		}
		const note = buildNotification(signup, ctx);
		const sent = await resend.emails.send({
			from: env.from,
			to: env.notifyTo,
			replyTo: signup.email,
			subject: note.subject,
			text: note.text,
			html: note.html,
		});
		if (sent.error) {
			logFailure("emails.send(notify)", sent.error);
			return SERVER;
		}

		// 6. optional confirmation to the signup
		if (env.confirmFrom) {
			const c = buildConfirmation(env.siteUrl);
			const conf = await resend.emails.send({ from: env.confirmFrom, to: signup.email, ...c });
			// The signup is already saved and the owner notified; a failed courtesy email is only logged.
			if (conf.error) logFailure("emails.send(confirm)", conf.error);
		}
	} catch (e) {
		// Network-level failure (the SDK itself does not throw for API errors).
		logFailure("resend", { name: e instanceof Error ? e.name : "unknown" });
		return SERVER;
	}

	return OK;
}
