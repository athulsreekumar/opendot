import { isIP } from "node:net";
import nlp from "compromise";
import { type CountryCode, findPhoneNumbersInText } from "libphonenumber-js";
import type { PiiSettings, PiiType } from "../../shared/types";

export interface PiiSpan {
	type: PiiType;
	start: number;
	end: number;
	value: string;
}

export interface DetectOptions {
	types: Set<PiiType>;
	customTerms: PiiSettings["customTerms"];
	detectNames: boolean;
	defaultCountry?: string;
}

const TYPE_PRIORITY: Record<PiiType, number> = {
	URL_CRED: 0,
	SECRET: 1,
	CARD: 2,
	IBAN: 3,
	SSN: 4,
	EMAIL: 5,
	IP: 6,
	PHONE: 7,
	PERSON: 8,
	ADDRESS: 9,
	CUSTOM: 10,
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g;
const SSN_RE = /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;
const IPV4_RE = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\d|\.\d)/g;
const IPV6_CANDIDATE_RE = /[0-9a-f:]{6,}/gi;
const URL_CRED_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi;
const TOKEN_RE = /⟦[^⟧]*⟧/g;

const SECRET_RES: RegExp[] = [
	/sk-[A-Za-z0-9_-]{20,}/g,
	/sk-ant-[A-Za-z0-9_-]{20,}/g,
	/gh[pousr]_[A-Za-z0-9]{36,}/g,
	/xox[abprs]-[A-Za-z0-9-]{10,}/g,
	/AKIA[0-9A-Z]{16}/g,
	/AIza[0-9A-Za-z_-]{35}/g,
	/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
];

/** Common capitalised words compromise sometimes tags as names. */
const NAME_STOPLIST = new Set(
	(
		"the and for are but not you all any can had her was one our out day get has him his how man new now old see two " +
		"way who boy did its let put say she too use dad mom sir mrs mr ms dr hello hi hey dear thanks thank please " +
		"monday tuesday wednesday thursday friday saturday sunday january february march april may june july august " +
		"september october november december today tomorrow yesterday this that these those there here what when where " +
		"which while with without from into over under again then once about after before because been being both each " +
		"few more most other some such only own same than very will just should would could might must shall also " +
		"yes no ok okay sure well best regards sincerely cheers team admin user assistant system mail email phone call " +
		"note notes todo test demo example sample file folder project task meeting report summary review update " +
		"google apple microsoft amazon github slack zoom claude openai anthropic english spanish french german"
	).split(" "),
);

function* matchAll(re: RegExp, text: string): Generator<RegExpExecArray> {
	const r = new RegExp(re.source, re.flags);
	let m = r.exec(text);
	while (m !== null) {
		yield m;
		if (m[0].length === 0) r.lastIndex++;
		m = r.exec(text);
	}
}

function luhn(digits: string): boolean {
	let sum = 0;
	let dbl = false;
	for (let i = digits.length - 1; i >= 0; i--) {
		let d = digits.charCodeAt(i) - 48;
		if (dbl) {
			d *= 2;
			if (d > 9) d -= 9;
		}
		sum += d;
		dbl = !dbl;
	}
	return sum % 10 === 0;
}

function ibanValid(iban: string): boolean {
	if (iban.length < 15 || iban.length > 34) return false;
	const rearranged = iban.slice(4) + iban.slice(0, 4);
	let rem = 0;
	for (const ch of rearranged) {
		const code = ch.charCodeAt(0);
		const v = code >= 65 ? String(code - 55) : ch;
		for (const c of v) rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
	}
	return rem === 1;
}

function push(out: PiiSpan[], type: PiiType, text: string, start: number, end: number): void {
	out.push({ type, start, end, value: text.slice(start, end) });
}

function detectCards(text: string, out: PiiSpan[]): void {
	for (const m of matchAll(CARD_RE, text)) {
		const trimmed = m[0].replace(/[ -]+$/, "");
		const digits = trimmed.replace(/\D/g, "");
		if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
			push(out, "CARD", text, m.index, m.index + trimmed.length);
		}
	}
}

function detectIbans(text: string, out: PiiSpan[]): void {
	for (const m of matchAll(IBAN_RE, text)) {
		// The greedy match may overrun; try ever shorter alphanumeric prefixes.
		const alnumEnds: number[] = [];
		for (let i = 0; i < m[0].length; i++) {
			if (/[A-Z0-9]/.test(m[0].charAt(i))) alnumEnds.push(i + 1);
		}
		for (let k = alnumEnds.length - 1; k >= 14; k--) {
			const end = alnumEnds[k] as number;
			const compact = m[0].slice(0, end).replace(/ /g, "");
			if (ibanValid(compact)) {
				push(out, "IBAN", text, m.index, m.index + end);
				break;
			}
		}
	}
}

function detectIps(text: string, out: PiiSpan[]): void {
	for (const m of matchAll(IPV4_RE, text)) {
		if (m[0].startsWith("127.") || m[0] === "0.0.0.0") continue;
		push(out, "IP", text, m.index, m.index + m[0].length);
	}
	for (const m of matchAll(IPV6_CANDIDATE_RE, text)) {
		if (!m[0].includes(":") || m[0] === "::1" || m[0] === "::") continue;
		if (isIP(m[0]) === 6) push(out, "IP", text, m.index, m.index + m[0].length);
	}
}

function detectPhones(text: string, defaultCountry: string | undefined, out: PiiSpan[]): void {
	let found: Array<{ number: { isValid(): boolean }; startsAt: number; endsAt: number }>;
	try {
		// `v2` is accepted at runtime but missing from the bundled typings.
		const opts = { defaultCountry: defaultCountry as CountryCode | undefined, v2: true };
		found = findPhoneNumbersInText(text, opts as never) as unknown as typeof found;
	} catch {
		return;
	}
	for (const f of found) {
		if (!f.number.isValid()) continue;
		const raw = text.slice(f.startsAt, f.endsAt);
		const digits = raw.replace(/\D/g, "");
		// Dates (2026-10-04), time ranges, ISBN-like hyphenated runs and bare short numbers are not phones.
		if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw) || /^\d{1,2}:\d{2}/.test(raw)) continue;
		if (/^97[89]/.test(digits) && digits.length === 13) continue;
		if (!raw.startsWith("+") && digits.length < 7) continue;
		push(out, "PHONE", text, f.startsAt, f.endsAt);
	}
}

function detectNames(text: string, out: PiiSpan[]): void {
	const offsets = nlp(text)
		.people()
		.out("offsets" as never) as Array<{ offset?: { start: number; length: number } }>;
	for (const o of offsets) {
		const off = o.offset;
		if (!off) continue;
		let start = off.start;
		let end = off.start + off.length;
		// Trim whitespace / punctuation from both ends.
		while (start < end && /[\s.,;:!?'"()]/.test(text.charAt(start))) start++;
		while (end > start && /[\s.,;:!?'"()]/.test(text.charAt(end - 1))) end--;
		const value = text.slice(start, end);
		const tokens = value.split(/\s+/).filter(Boolean);
		if (tokens.length === 0) continue;
		if (tokens.every((t) => NAME_STOPLIST.has(t.toLowerCase()))) continue;
		if (tokens.length === 1) {
			const t = tokens[0] as string;
			if (t.length < 3 || !/^\p{Lu}/u.test(t) || NAME_STOPLIST.has(t.toLowerCase())) continue;
		}
		out.push({ type: "PERSON", start, end, value });
	}
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectCustom(text: string, terms: PiiSettings["customTerms"], out: PiiSpan[]): void {
	const sorted = terms.filter((t) => t.term.trim().length > 0).sort((a, b) => b.term.length - a.term.length);
	for (const t of sorted) {
		const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(t.term.trim())}(?![\\p{L}\\p{N}_])`, "giu");
		for (const m of matchAll(re, text)) push(out, t.type, text, m.index, m.index + m[0].length);
	}
}

export function detectPii(text: string, opts: DetectOptions): PiiSpan[] {
	if (!text) return [];
	const raw: PiiSpan[] = [];
	const has = (t: PiiType) => opts.types.has(t);

	if (has("URL_CRED"))
		for (const m of matchAll(URL_CRED_RE, text)) push(raw, "URL_CRED", text, m.index, m.index + m[0].length);
	if (has("SECRET")) {
		for (const re of SECRET_RES)
			for (const m of matchAll(re, text)) push(raw, "SECRET", text, m.index, m.index + m[0].length);
	}
	if (has("CARD")) detectCards(text, raw);
	if (has("IBAN")) detectIbans(text, raw);
	if (has("SSN")) for (const m of matchAll(SSN_RE, text)) push(raw, "SSN", text, m.index, m.index + m[0].length);
	if (has("EMAIL")) for (const m of matchAll(EMAIL_RE, text)) push(raw, "EMAIL", text, m.index, m.index + m[0].length);
	if (has("IP")) detectIps(text, raw);
	if (has("PHONE")) {
		const phones: PiiSpan[] = [];
		detectPhones(text, opts.defaultCountry, phones);
		// A phone candidate that overlaps a stronger detector (card, SSN, IBAN...) is that, not a phone.
		for (const p of phones) {
			if (!raw.some((s) => s.start < p.end && p.start < s.end)) raw.push(p);
		}
	}
	// Custom terms always apply; PERSON/ADDRESS only come from custom terms (plus names when enabled).
	detectCustom(text, opts.customTerms, raw);
	if (opts.detectNames && has("PERSON")) detectNames(text, raw);

	// Drop spans touching existing ⟦…⟧ tokens.
	const protectedRanges: Array<[number, number]> = [];
	for (const m of matchAll(TOKEN_RE, text)) protectedRanges.push([m.index, m.index + m[0].length]);
	const candidates = protectedRanges.length
		? raw.filter((s) => !protectedRanges.some(([a, b]) => s.start < b && a < s.end))
		: raw;

	candidates.sort(
		(a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type],
	);
	const kept: PiiSpan[] = [];
	let lastEnd = -1;
	for (const s of candidates) {
		if (s.start >= lastEnd) {
			kept.push(s);
			lastEnd = s.end;
		}
	}
	return kept;
}
