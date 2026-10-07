import type { BuiltinSkill } from "./types";

export const SALES_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:sales-outreach-draft",
		name: "Draft outreach",
		description: "Write a short, personal first message to a prospect, with a clear ask.",
		domain: "sales",
		body: `Use this when the user wants to contact a new lead, partner or customer.

## Steps
1. Find out who the person is, what they do, and one real reason to contact them now. Use only facts you were given or can verify.
2. Decide the one thing you want: a reply, a short call, or a yes or no on a question.
3. Write the subject line: short, specific, and not clickbait.
4. Write the message in four to six sentences: why you are writing to them, what you can do for them, a small proof (only if true), and the ask.
5. Make the ask easy: offer two time slots or a yes-or-no question.
6. Prepare a short follow-up for a few days later that adds something new instead of "just checking in".

## A good result
- Short enough to read on a phone.
- Sounds like a person. No buzzwords, no fake urgency, no false familiarity.
- Nothing invented: no made-up mutual contacts, results or deadlines.
- Respects opt-outs and the laws on unsolicited messages.

## Ask the user first
Ask who the person is, what you are offering and what the user wants to happen. Never send the message yourself. Show the draft and wait for approval.`,
	},
	{
		id: "builtin:sales-account-brief",
		name: "Prepare an account brief",
		description: "Summarise what we know about a customer or prospect before a call or meeting.",
		domain: "sales",
		body: `Use this before a call, a renewal or a proposal.

## Steps
1. Gather what is on record: who they are, size, what they bought or asked for, past conversations, open issues, key contacts.
2. Add public context that you can verify: recent news, products, changes in the team. Mark the source of each fact.
3. Describe where the relationship stands: new, growing, at risk, or stalled, and why.
4. List what they likely care about, and say which of these are facts and which are guesses.
5. Prepare three to five questions that would help you learn more.
6. Suggest a goal for the meeting and the next step you want to agree on.
7. Note risks: unhappy contacts, late invoices, open support tickets, competitors.

## A good result
- One page, with the goal and the questions at the top.
- Facts and guesses are clearly separated.
- Nothing from private notes is quoted back to the customer.
- Personal details are limited to what is relevant to the business.

## Ask the user first
Ask which account and what the meeting is for. If the records are thin, say so instead of filling the gaps.`,
	},
];
