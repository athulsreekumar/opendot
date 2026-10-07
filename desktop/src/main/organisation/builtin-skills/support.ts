import type { BuiltinSkill } from "./types";

export const SUPPORT_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:support-triage-ticket",
		name: "Triage a support ticket",
		description: "Sort a customer message by type and urgency, and draft a first reply.",
		domain: "support",
		body: `Use this when a customer message or ticket arrives and needs a first response.

## Steps
1. Read the whole message. Identify what the customer wants: a fix, an answer, a refund, a feature, or to complain.
2. Classify it: bug, how-to question, billing, account access, feature request, or abuse and safety.
3. Set the urgency. High: a service is down, money or security is involved, or many people are affected. Normal: one person is blocked. Low: a question or idea.
4. Check for known answers: help articles, earlier tickets, known issues.
5. Draft a reply: thank them briefly, say you understand the problem in your own words, give the answer or the next step, and say when they will hear back.
6. If you need more information, ask for the one or two things that matter, such as steps, screenshots or the time it happened.
7. Decide who should take it if it is not yours: engineering, billing, or the user.

## A good result
- A short, kind, honest reply with no jargon and no promises you cannot keep.
- A one-line summary of the ticket for whoever picks it up.
- No personal data repeated more than needed.

## Ask the user first
Ask before issuing a refund, promising a date, or sending anything about security or legal issues. Show the draft first.`,
	},
	{
		id: "builtin:support-write-help-article",
		name: "Write a help article",
		description: "Turn a recurring question into a clear step-by-step help article.",
		domain: "support",
		body: `Use this when the same question keeps coming up, or a new feature needs documentation.

## Steps
1. State the question the way a customer would ask it. That becomes the title, for example "How do I change my email address?".
2. Say who the article is for and what they will be able to do at the end.
3. Check the steps yourself, or ask someone who can. Never write steps you have not confirmed.
4. Write numbered steps with one action each, naming the exact buttons and menus. Keep sentences short.
5. Add what can go wrong and the fix, in a short list.
6. Add related articles, and how to contact support if it still does not work.
7. Read it as a beginner. Remove jargon and anything that is not needed.

## A good result
- Under 400 words, easy to scan, with headings and numbered steps.
- Correct for the current version of the product, and it says which version.
- No screenshots with personal data.
- A plain tone that is friendly but not chatty.

## Ask the user first
Ask which version or plan the article is for, and where it will be published. Do not publish it yourself. Hand the draft to the user.`,
	},
];
