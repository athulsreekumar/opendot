import type { BuiltinSkill } from "./types";

export const ADMIN_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:admin-meeting-notes-and-actions",
		name: "Meeting notes and actions",
		description: "Turn a meeting into short notes, decisions and a list of actions with owners and dates.",
		domain: "admin",
		body: `Use this after a meeting, or when given a transcript or rough notes.

## Steps
1. Note the meeting title, date and who was there.
2. Write the purpose in one line.
3. Pull out the decisions made. Write each as a plain sentence, such as "We will launch on 14 March".
4. Pull out the actions. Each needs a verb, an owner and a date. If the owner or date is missing, mark it "needs owner" instead of guessing.
5. List open questions and what is needed to answer them.
6. Add a few lines of context only where someone who was absent would be lost.
7. Draft a short follow-up message with the decisions and actions.

## A good result
- Under one page.
- Decisions and actions come first, discussion summary last.
- Nothing was invented. If the notes were unclear, say so.
- Names and dates are spelled consistently.

## Ask the user first
Ask before sending the follow-up to anyone. Ask who owns an action if the notes do not say. Treat what was said in the meeting as private to the attendees.`,
	},
	{
		id: "builtin:admin-vendor-onboarding",
		name: "Onboard a vendor",
		description: "Collect what is needed before working with a new supplier: details, terms, risks and approvals.",
		domain: "admin",
		body: `Use this when the team wants to start working with a new supplier or tool provider.

## Steps
1. Write down what the vendor will do, for how long, and the expected cost.
2. Collect the basics: legal name, contact, website, country, tax or registration number, and how they will invoice.
3. Get at least two alternatives or a reason there are none, for anything above a small spend.
4. Check the terms: price, payment dates, renewal and cancellation, who owns the work and the data.
5. Ask whether the vendor will see personal or confidential data. If yes, flag it for security and legal review before anything is shared.
6. Collect the approvals needed: budget owner, finance, and where relevant legal and security.
7. Record everything in one place, and set a reminder for the renewal date.

## A good result
- A one-page summary with the decision needed at the top.
- Nothing is signed, paid or shared before the right people approve.
- Missing information is listed, not skipped.

## Ask the user first
Always ask before signing, paying, or sharing company data with a vendor. These steps are the user's to approve.`,
	},
];
