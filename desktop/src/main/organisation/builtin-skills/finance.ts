import type { BuiltinSkill } from "./types";

export const FINANCE_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:finance-budget-check",
		name: "Check a budget",
		description: "Compare planned and actual spending, explain the gaps and flag risks.",
		domain: "finance",
		body: `Use this when someone asks if a project, team or month is on budget, or wants a forecast.

## Steps
1. Get the budget and the actuals for the same period and the same categories. Note the currency.
2. Compute the difference for each line, in amount and in percent.
3. Explain the largest gaps. Separate one-off costs, timing differences (paid early or late) and real overspend.
4. Check commitments that are not yet paid: signed contracts, open orders, subscriptions that renew soon.
5. Make a simple forecast to the end of the period: actuals so far plus known commitments plus a normal run rate.
6. State the risks and the range, not only one number.

## A good result
- The headline first: on track, over by X, or under by Y.
- A small table of the top lines, with totals that add up. Double check the arithmetic.
- Every number says where it came from.
- Assumptions are written down.

## Ask the user first
Ask which period and currency, and whether tax is included. You do not move money, approve spending or give tax or investment advice. Say so if asked, and point to an accountant.`,
	},
	{
		id: "builtin:finance-expense-review",
		name: "Review expenses",
		description: "Check expense claims or invoices against policy and flag what looks wrong.",
		domain: "finance",
		body: `Use this when expense claims, receipts or supplier invoices need checking before payment.

## Steps
1. Check each item has a receipt or invoice, a date, an amount, a currency and a business reason.
2. Compare with the policy: limits per category, approved vendors, what needs pre-approval.
3. Look for problems: duplicates, round numbers repeated, weekend or holiday dates without a reason, amounts that differ from the receipt, personal items.
4. Check tax and currency conversion where the claim includes them.
5. Group the items: fine, needs a question, and not allowed under the policy.
6. For each question, write what you need from the person in one sentence.
7. Give the total of what is ready for approval.

## A good result
- A short list by status, with the reason next to each problem.
- A neutral tone: you flag, you do not accuse.
- Totals add up and match the receipts.
- No payment is made or approved by you.

## Ask the user first
Ask for the expense policy if you do not have it, and do not guess limits. Keep bank details and card numbers out of chat and out of notes.`,
	},
];
