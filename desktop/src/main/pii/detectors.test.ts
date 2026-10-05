import { describe, expect, it } from "vitest";
import type { PiiType } from "../../shared/types";
import { detectPii } from "./detectors";

const ALL = new Set<PiiType>([
	"EMAIL",
	"PHONE",
	"CARD",
	"IBAN",
	"SSN",
	"IP",
	"SECRET",
	"PERSON",
	"ADDRESS",
	"CUSTOM",
	"URL_CRED",
]);
const base = { types: ALL, customTerms: [], detectNames: false, defaultCountry: "US" };
const detect = (text: string, extra: Partial<Parameters<typeof detectPii>[1]> = {}) =>
	detectPii(text, { ...base, ...extra });

const sk = `sk-ant-api03-${"AbCdEf0123456789xyzXYZ_-abcdef".slice(0, 30)}`;
const ghp = `ghp_${"a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8".slice(0, 36)}`;

describe("detectPii positives", () => {
	const cases: Array<[string, PiiType]> = [
		["john.doe+test@example.co.uk", "EMAIL"],
		["+1 415-555-2671", "PHONE"],
		["(415) 555-2671", "PHONE"],
		["+44 20 7946 0958", "PHONE"],
		["4111 1111 1111 1111", "CARD"],
		["5500-0000-0000-0004", "CARD"],
		["GB82 WEST 1234 5698 7654 32", "IBAN"],
		["DE89370400440532013000", "IBAN"],
		["123-45-6789", "SSN"],
		["192.168.1.24", "IP"],
		["2001:db8::ff00:42:8329", "IP"],
		[sk, "SECRET"],
		[ghp, "SECRET"],
		["AKIAIOSFODNN7EXAMPLE", "SECRET"],
		["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_abc", "SECRET"],
		["https://bob:hunter2@db.example.com", "URL_CRED"],
	];
	for (const [value, type] of cases) {
		it(`detects ${type}: ${value}`, () => {
			const spans = detect(`contact ${value} please`);
			const hit = spans.find((s) => s.type === type);
			expect(hit, JSON.stringify(spans)).toBeDefined();
			expect(hit?.value).toBe(value.startsWith("https://") ? "https://bob:hunter2@" : value);
		});
	}

	it("matches custom PERSON term case-insensitively", () => {
		const spans = detect("athul sreekumar said hi", { customTerms: [{ term: "Athul Sreekumar", type: "PERSON" }] });
		expect(spans).toEqual([{ type: "PERSON", start: 0, end: 15, value: "athul sreekumar" }]);
	});

	it("custom terms respect word boundaries", () => {
		expect(detect("Acmeville", { customTerms: [{ term: "Acme", type: "CUSTOM" }] })).toEqual([]);
	});

	it("detects names with compromise when enabled", () => {
		const spans = detect("Yesterday Barack Obama met Angela Merkel.", { detectNames: true });
		expect(spans.filter((s) => s.type === "PERSON").map((s) => s.value)).toEqual(
			expect.arrayContaining(["Barack Obama", "Angela Merkel"]),
		);
		expect(detect("Barack Obama", { detectNames: false })).toEqual([]);
	});

	it("respects the enabled type set", () => {
		expect(detect("a@b.com", { types: new Set<PiiType>(["IP"]) })).toEqual([]);
	});
});

describe("detectPii negatives", () => {
	const negatives = [
		"4111 1111 1111 1112",
		"000-12-3456",
		"127.0.0.1",
		"version 1.2.3.4.5",
		"call me at 5",
		"user@localhost",
		"10:30-11:45",
		"2026-10-04",
		"ISBN 978-3-16-148410-0",
		"::1",
		"0.0.0.0",
	];
	for (const text of negatives) {
		it(`ignores: ${text}`, () => {
			expect(detect(text)).toEqual([]);
		});
	}

	it("ignores an existing token", () => {
		expect(detect("hello ⟦EMAIL_1⟧ and ⟦PHONE_2⟧")).toEqual([]);
	});
});

describe("overlap resolution", () => {
	it("longest span wins and nothing overlaps", () => {
		const spans = detect("mail a.b@example.com now", {
			customTerms: [
				{ term: "a.b@example.com", type: "CUSTOM" },
				{ term: "example", type: "CUSTOM" },
			],
		});
		expect(spans).toHaveLength(1);
		expect(spans[0]?.value).toBe("a.b@example.com");
	});

	it("card is not also reported as a phone", () => {
		const spans = detect("4111 1111 1111 1111");
		expect(spans.map((s) => s.type)).toEqual(["CARD"]);
	});

	it("spans are sorted and disjoint", () => {
		const spans = detect(`a@b.com, 192.168.1.24, ${sk}, 123-45-6789`);
		for (let i = 1; i < spans.length; i++)
			expect((spans[i] as { start: number }).start).toBeGreaterThanOrEqual((spans[i - 1] as { end: number }).end);
		expect(spans.map((s) => s.type)).toEqual(["EMAIL", "IP", "SECRET", "SSN"]);
	});
});
