import type { BuiltinSkill } from "./types";

export const HR_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:hr-job-description",
		name: "Write a job description",
		description: "Write a clear, fair job post that attracts the right people.",
		domain: "hr",
		body: `Use this when the team wants to hire or rewrite a role.

## Steps
1. Find out why the role exists: what work is not getting done, and what success looks like after six months.
2. Write a short, honest intro about the team and the work.
3. List the main responsibilities, five to seven bullets, starting with verbs.
4. Separate must-have skills from nice-to-have. Keep must-haves to what the person truly needs on day one.
5. Say what is offered: pay range if allowed, location or remote rules, hours, and the steps of the hiring process.
6. Use plain, inclusive language. Avoid slang, age or gender hints, and long lists of requirements that quietly exclude people.
7. End with how to apply.

## A good result
- One page, under 500 words.
- Someone reading it can tell if they should apply.
- Nothing in it is a promise the company has not agreed to.
- It follows local rules on pay transparency and equal opportunity. If you are not sure of them, say so.

## Ask the user first
Ask for the title, the level, the location, the pay range, and who the person reports to. Do not invent pay or benefits.`,
	},
	{
		id: "builtin:hr-onboarding-checklist",
		name: "Plan onboarding",
		description: "Make a first-day, first-week and first-month plan for a new hire.",
		domain: "hr",
		body: `Use this when someone is about to join, or when onboarding keeps going wrong.

## Steps
1. Collect the basics: name, role, start date, manager, location or remote.
2. Before day one: contract and paperwork, equipment, accounts and access (ask IT), a welcome message, and the first-day schedule.
3. Day one: a warm welcome, a tour or call, introductions, the list of tools, and one small thing they can finish.
4. First week: meet the team, read the key documents, a first real task with a buddy, and a check-in with the manager.
5. First month: goals for 30, 60 and 90 days, regular one-to-ones, and a feedback conversation at the end of the month.
6. Assign an owner and a due date to every item.

## A good result
- A checklist with owners and dates that a manager can follow without help.
- The new person always knows who to ask.
- Nothing is left until "someone gets round to it".

## Ask the user first
Ask for the start date and which tools the person needs. Keep personal details (address, bank, health) out of shared documents, and never put them in chat. Ask the user to handle those directly.`,
	},
];
