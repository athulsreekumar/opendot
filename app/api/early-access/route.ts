import { Resend } from "resend";
import { type EmailPayload, handleSignup, type ResendLike, type ResendResult } from "@/lib/early-access";
import { readEnv } from "@/lib/env";
import { limit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
const NO_STORE = { "Cache-Control": "no-store" };

type MockCall = { method: string; payload: unknown };
const g = globalThis as unknown as { __odMockCalls?: MockCall[]; __odMockContacts?: Set<string> };

/** In-memory Resend stand-in for e2e (RESEND_MOCK=1). Emails containing "+dup" always count as duplicates. */
function createMock(): ResendLike {
	g.__odMockCalls ??= [];
	const calls = g.__odMockCalls;
	g.__odMockContacts ??= new Set();
	const contacts = g.__odMockContacts;
	const ok: ResendResult = { data: { id: "mock" }, error: null };
	return {
		contacts: {
			async get(o) {
				calls.push({ method: "contacts.get", payload: o });
				if (o.email.includes("+dup") || contacts.has(o.email)) return ok;
				return { data: null, error: { name: "not_found", message: "not found", statusCode: 404 } };
			},
			async create(p) {
				calls.push({ method: "contacts.create", payload: p });
				contacts.add(p.email);
				return ok;
			},
		},
		emails: {
			async send(p: EmailPayload) {
				calls.push({ method: "emails.send", payload: p });
				return ok;
			},
		},
	};
}

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
	return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export async function POST(req: Request) {
	const env = readEnv();
	const mock = env.mock;
	if (!mock && (!env.resendApiKey || !env.notifyTo)) {
		console.error("[early-access] RESEND_API_KEY or EARLY_ACCESS_NOTIFY_TO is not configured");
		return json(503, { ok: false, error: "server" });
	}

	const declared = Number(req.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { ok: false, error: "invalid" });
	const raw = await req.text();
	if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return json(413, { ok: false, error: "invalid" });

	let input: unknown;
	try {
		input = JSON.parse(raw);
	} catch {
		return json(400, { ok: false, error: "invalid" });
	}

	const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const ip = fwd || req.headers.get("x-real-ip")?.trim() || "unknown";

	const resend: ResendLike = mock ? createMock() : (new Resend(env.resendApiKey) as unknown as ResendLike);
	const effectiveEnv = mock
		? {
				...env,
				resendAudienceId: env.resendAudienceId ?? "mock-audience",
				notifyTo: env.notifyTo ?? "notify@example.test",
			}
		: env;

	const res = await handleSignup(
		input,
		{
			ip,
			country: req.headers.get("x-vercel-ip-country") ?? undefined,
			userAgent: req.headers.get("user-agent") ?? undefined,
			now: new Date(),
		},
		// Test mode (RESEND_MOCK=1): e2e suites sign up many times from one IP, so skip the rate limiter there.
		{ limit: mock ? async () => ({ ok: true }) : limit, resend, env: effectiveEnv },
	);
	return json(res.status, res.body);
}

export async function GET(req: Request) {
	if (readEnv().mock && new URL(req.url).searchParams.get("mock") === "calls") {
		return json(200, { calls: g.__odMockCalls ?? [] });
	}
	return methodNotAllowed();
}

function methodNotAllowed() {
	return json(405, { ok: false, error: "method" }, { Allow: "POST" });
}
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
