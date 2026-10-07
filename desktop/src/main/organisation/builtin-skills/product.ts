import type { BuiltinSkill } from "./types";

export const PRODUCT_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:product-write-prd",
		name: "Write a product requirements doc",
		description: "Write a short PRD: problem, users, scope, success measures and open questions.",
		domain: "product",
		body: `Use this when a feature or change needs a written definition before people build it.

## Steps
1. Write the problem in two or three sentences: who has it, how often, and what it costs them today.
2. Name the users or customers and, if you know it, the evidence (support requests, interviews, numbers).
3. State the goal and how you will know it worked: one or two measures with a target.
4. Describe the scope as short user stories or bullets. Then list what is out of scope on purpose.
5. Note constraints: deadlines, legal or security needs, systems it touches.
6. List open questions and who can answer each.
7. Add a rough plan: the smallest first release, then what comes after.

## A good result
- Fits on one or two pages.
- An engineer and a designer could start from it without a meeting.
- Every requirement can be tested: "a user can reset their password by email", not "easy password reset".
- Assumptions are marked as assumptions.

## Ask the user first
Ask who the main user is, what the deadline is, and what the one thing is that must work. Do not invent customer evidence.`,
	},
	{
		id: "builtin:product-prioritise",
		name: "Prioritise a list",
		description: "Rank features or tasks by value, effort and risk, and explain the order.",
		domain: "product",
		body: `Use this when there are more ideas or tasks than time.

## Steps
1. Collect the items with one line each. Merge duplicates.
2. For each item, estimate value (how many people, how much it matters), effort (small, medium, large) and risk (what could go wrong, what is unknown).
3. Mark items that unblock others, or that have a hard date. These move up.
4. Sort by value for effort. Quick wins first, big bets next, low value last.
5. Pick a cut line: what fits in the time or budget you have. Say clearly what falls below it.
6. Write the reasoning for the top five in one sentence each.

## A good result
- A ranked list, not a table of scores nobody trusts.
- The trade-offs are visible: "A before B because it unblocks C".
- Estimates are labelled as guesses when they are.
- The user can disagree with one item without redoing everything.

## Ask the user first
Ask what matters most right now: revenue, speed, quality, or risk reduction. Without it, say which you assumed.`,
	},
];
