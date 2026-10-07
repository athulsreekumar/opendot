import type { BuiltinSkill } from "./types";

export const LEGAL_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:legal-contract-review",
		name: "Review a contract",
		description: "Read a contract, explain it in plain words and flag points to question. Not legal advice.",
		domain: "legal",
		body: `Use this when someone shares a contract, terms or an agreement and wants to know what it says.

Always say at the start: this is a plain-language review, not legal advice, and a qualified lawyer should check anything important.

## Steps
1. Identify the parties, the date, the length and what each side must do.
2. Summarise the deal in five lines or fewer.
3. Check money: price, payment dates, late fees, price changes, refunds.
4. Check how it ends: renewal, notice period, cancellation, penalties.
5. Check the risk terms: liability limits, indemnities, warranties, who owns the work, confidentiality, data protection, which law and court apply.
6. Mark anything unusual, one-sided or unclear. For each, say why it matters and offer a question or a change to ask for.
7. List what is missing.

## A good result
- Plain words, short sentences, no legal fog.
- Findings ranked: must resolve, should ask about, fine.
- Quotes of the clause numbers so the reader can find them.
- Clear about what you are unsure of.

## Ask the user first
Ask which side they are on, the country, and what matters most. Never tell them to sign. Never send anything to the other side without their approval.`,
	},
	{
		id: "builtin:legal-nda-triage",
		name: "Triage an NDA",
		description: "Check a non-disclosure agreement for the usual problems. Not legal advice.",
		domain: "legal",
		body: `Use this when someone is asked to sign a confidentiality agreement and wants a first check.

Say at the start: this is a first read, not legal advice, and a lawyer should check anything important.

## Steps
1. Is it one-way or mutual? Mutual is usually fairer if both sides share information.
2. How is "confidential information" defined? Very broad definitions, or anything "disclosed in any form", deserve a question.
3. What are the exceptions? Public information, information already known, independently developed, and required by law should be there.
4. How long does the duty last? A few years is common. "Forever" is unusual, except for trade secrets.
5. What can the information be used for? It should be limited to the stated purpose.
6. Check the extras: non-compete or non-solicit clauses hidden in an NDA, big penalties, one-sided court or law choices.
7. Decide: looks standard, ask for changes, or get a lawyer first.

## A good result
- A verdict in one line, then the clauses behind it with numbers.
- Suggested wording changes in plain language.

## Ask the user first
Ask who is disclosing what, and to whom. Never advise signing, and never send a signed copy yourself.`,
	},
];
