import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DotId, PiiMode, PiiSettings } from "../../shared/types";
import { PiiService, type PiiServiceDeps } from "./pii-service";
import { PiiVault } from "./vault";

const DOT = "dot_abc" as DotId;
let dir: string;
let key: Buffer;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pii-test-"));
	key = randomBytes(32);
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const settings: PiiSettings = {
	enabledTypes: ["EMAIL", "PHONE", "CARD", "IBAN", "SSN", "IP", "SECRET", "URL_CRED", "CUSTOM", "PERSON"],
	customTerms: [{ term: "Athul Sreekumar", type: "PERSON" }],
	detectNames: false,
};

function makeService(over: Partial<PiiServiceDeps> = {}): PiiService {
	return new PiiService({
		getSettings: async () => settings,
		vaultFile: (id) => join(dir, "pii", `${id}.vault`),
		getVaultKey: async () => key,
		isLocalDot: async () => false,
		getPiiMode: async () => "auto" as PiiMode,
		defaultCountry: "US",
		...over,
	});
}

describe("PiiVault", () => {
	it("round-trips on disk with 0600 and a per-type counter", async () => {
		const file = join(dir, "sub", "v.vault");
		const v = await PiiVault.open(file, async () => key);
		const t1 = v.tokenFor({ type: "EMAIL", value: "A@b.com" });
		const t2 = v.tokenFor({ type: "EMAIL", value: "c@d.com" });
		const t3 = v.tokenFor({ type: "PHONE", value: "+1 415-555-2671" });
		expect([t1, t2, t3]).toEqual(["⟦EMAIL_1⟧", "⟦EMAIL_2⟧", "⟦PHONE_1⟧"]);
		expect(v.tokenFor({ type: "EMAIL", value: "a@B.com" })).toBe(t1);
		expect(v.tokenFor({ type: "PHONE", value: "+14155552671" })).toBe(t3);
		await v.flush();
		// Windows has no POSIX permission bits; the vault file is already private to the user profile there.
		if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);

		const v2 = await PiiVault.open(file, async () => key);
		expect(v2.valueOf(t1)).toBe("A@b.com");
		expect(v2.entries()).toHaveLength(3);
		expect(v2.tokenFor({ type: "EMAIL", value: "new@x.org" })).toBe("⟦EMAIL_3⟧");

		await expect(PiiVault.open(file, async () => randomBytes(32))).rejects.toThrow();
		await v2.destroy();
		expect(existsSync(file)).toBe(false);
	});

	it("debounced save eventually writes", async () => {
		const file = join(dir, "d.vault");
		const v = await PiiVault.open(file, async () => key);
		v.tokenFor({ type: "SSN", value: "123-45-6789" });
		await v.save();
		expect(existsSync(file)).toBe(true);
	});
});

describe("PiiService", () => {
	it("is deterministic for the same email", async () => {
		const s = makeService();
		const a = await s.redact(DOT, "mail bob@example.com");
		const b = await s.redact(DOT, "again BOB@example.com please");
		expect(a.text).toBe("mail ⟦EMAIL_1⟧");
		expect(b.text).toBe("again ⟦EMAIL_1⟧ please");
		await s.flushAll();
	});

	it("restore(redact(x)) === x for 50 mixed strings", async () => {
		const s = makeService();
		const pool = [
			"bob.smith@example.com",
			"+1 415-555-2671",
			"4111 1111 1111 1111",
			"GB82 WEST 1234 5698 7654 32",
			"123-45-6789",
			"192.168.1.24",
			"2001:db8::ff00:42:8329",
			"AKIAIOSFODNN7EXAMPLE",
			"https://bob:hunter2@db.example.com",
			"Athul Sreekumar",
		];
		const filler = ["see", "x", "call", "on 2026-10-04 at 10:30-11:45", "v1.2.3.4.5", "127.0.0.1", "ok,"];
		for (let i = 0; i < 50; i++) {
			const parts: string[] = [];
			for (let j = 0; j < 4; j++) {
				parts.push(filler[(i + j * 3) % filler.length] as string);
				parts.push(pool[(i * 7 + j * 3) % pool.length] as string);
			}
			const x = parts.join(" ");
			const r = await s.redact(DOT, x);
			expect(r.spans.length).toBeGreaterThan(0);
			expect(r.text).not.toContain("hunter2");
			expect(r.text).not.toContain("@example.com");
			expect(s.restore(DOT, r.text)).toBe(x);
		}
		await s.flushAll();
	});

	it("persists across service instances", async () => {
		const s1 = makeService();
		const r = await s1.redact(DOT, "x@y.com");
		await s1.flushAll();
		const s2 = makeService();
		expect(s2.restore(DOT, r.text)).toBe(r.text); // not loaded yet
		await s2.ensureVault(DOT);
		expect(s2.restore(DOT, r.text)).toBe("x@y.com");
		expect(s2.restore(DOT, "⟦EMAIL_99⟧")).toBe("⟦EMAIL_99⟧");
	});

	it("restoreDeep and restoreInPlace walk nested args", async () => {
		const s = makeService();
		const r = await s.redact(DOT, "a@b.com and 192.168.1.24");
		const [e, ip] = ["⟦EMAIL_1⟧", "⟦IP_1⟧"];
		expect(r.text).toBe(`${e} and ${ip}`);
		const args = { to: [e], nested: { host: ip, n: 3, ok: true, nil: null }, s: `mail ${e}` };
		const out = s.restoreDeep(DOT, args);
		expect(out).toEqual({
			to: ["a@b.com"],
			nested: { host: "192.168.1.24", n: 3, ok: true, nil: null },
			s: "mail a@b.com",
		});
		expect(args.to[0]).toBe(e);
		s.restoreInPlace(DOT, args);
		expect(args).toEqual(out);
	});

	it("auto mode with a local model does not redact; always/off override", async () => {
		const local = makeService({ isLocalDot: async () => true });
		expect(await local.shouldRedact(DOT)).toBe(false);
		expect(await makeService().shouldRedact(DOT)).toBe(true);
		expect(
			await makeService({ isLocalDot: async () => true, getPiiMode: async () => "always" }).shouldRedact(DOT),
		).toBe(true);
		expect(await makeService({ getPiiMode: async () => "off" }).shouldRedact(DOT)).toBe(false);
	});

	it("preview uses a throwaway vault and destroyVault removes the file", async () => {
		const s = makeService();
		const p = await s.preview("hi a@b.com, c@d.com, a@b.com");
		expect(p.redacted).toBe("hi ⟦EMAIL_1⟧, ⟦EMAIL_2⟧, ⟦EMAIL_1⟧");
		expect(p.items.map((i) => i.type)).toEqual(["EMAIL", "EMAIL", "EMAIL"]);
		expect(existsSync(join(dir, "pii"))).toBe(false);
		await s.redact(DOT, "a@b.com");
		await s.flushAll();
		const file = join(dir, "pii", `${DOT}.vault`);
		expect(existsSync(file)).toBe(true);
		await s.destroyVault(DOT);
		expect(existsSync(file)).toBe(false);
	});
});
