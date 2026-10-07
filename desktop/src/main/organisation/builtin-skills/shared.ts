import type { BuiltinSkill } from "./types";

export const SHARED_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:write-status-update",
		name: "Write a status update",
		description: "Report progress in a short, honest update that a busy person can act on.",
		body: `Use this when you finish a task, hit a problem, or are asked how things are going.

## Steps
1. Start with the state in one word: done, in progress, blocked or at risk.
2. Say what you did, in plain sentences. Name each file or document you made and where it is.
3. Say what you did not do, or did only in part. Never let a gap hide inside a cheerful summary.
4. List decisions you made on your own and why, so the user can overrule them.
5. End with what you need next: a question, an approval, or nothing.

## A good result
- Under 150 words for a normal task.
- Facts first, no filler, no praise for your own work.
- Numbers and names instead of vague words ("3 of 5 pages", not "most").
- If you are unsure whether something works, say it is untested.

## Ask the user first
Only when the next step is risky or cannot be undone. A status update is not the place for a long list of questions: ask the one that matters most.`,
	},
	{
		id: "builtin:break-down-a-request",
		name: "Break down a request",
		description: "Turn a vague request into clear pieces of work with owners, order and a definition of done.",
		body: `Use this when a request is big, vague, or needs more than one person or step.

## Steps
1. Restate the goal in one sentence and check that it is what the user wants.
2. Write down what "done" looks like: something a person could check, not a feeling.
3. List the pieces of work. Each piece should be small enough to finish in one sitting and have one owner.
4. Mark which pieces depend on others. Pieces with no dependency can run in parallel, so do not chain them without a reason.
5. Note what could go wrong or is unknown, and who can find out.
6. Say which pieces need a second pair of eyes (security, legal, money, anything that cannot be undone).

## A good result
- Between 3 and 12 pieces. More than that means you are planning too finely.
- Every piece has a title, a short brief and a clear end.
- The first piece can start today.
- Assumptions are written down, not buried.

## Ask the user first
Ask before planning if the goal, the deadline or the budget is missing. Ask one or two questions, not ten. If the user says "you decide", decide and list the assumption.`,
	},
];
