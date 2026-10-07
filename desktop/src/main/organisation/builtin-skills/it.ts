import type { BuiltinSkill } from "./types";

export const IT_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:it-access-request",
		name: "Handle an access request",
		description: "Decide and record who gets access to which system, with least privilege and an end date.",
		domain: "it",
		body: `Use this when someone asks for access to a tool, folder, account or system.

## Steps
1. Write down who is asking, what they need access to, and why. "Because I need it" is not a reason; the task is.
2. Check the role. Give the least access that lets them do the task: read before write, one folder before the whole drive.
3. Check who owns the system and whether the owner has agreed. If not, ask the owner.
4. Prefer a time limit for anything sensitive, and note the end date.
5. Never share passwords in chat. Use invitations, groups or the tool's own sharing.
6. Record what was granted, to whom, when, and who approved it.
7. Tell the person how to start, and what to do if it does not work.

## A good result
- A short record that anyone could audit later.
- Access that matches the role, not the loudest request.
- Removing access is as easy as granting it. Say how.

## Ask the user first
Always ask before granting access to finance, HR, customer data or admin rights. Granting is the user's decision, not yours.`,
	},
	{
		id: "builtin:it-incident-runbook",
		name: "Run an incident",
		description: "Handle an outage or security scare: stabilise, communicate, find the cause, and write it up.",
		domain: "it",
		body: `Use this when something important is broken, down, or may have been compromised.

## Steps
1. Say what is wrong, since when, and who is affected. Note the time.
2. Stabilise first: stop the damage, roll back a recent change, or switch to a backup. Do not hunt for the cause while users are stuck.
3. Tell the affected people early with a short message: what is broken, what you are doing, when you will update next.
4. Collect facts: recent changes, logs, error messages, what changed on the user's side. Keep notes with times.
5. Find the likely cause and test it. Change one thing at a time.
6. Confirm the fix with the people who were affected.
7. Write a short review: timeline, cause, what worked, and two or three follow-ups with owners.

## A good result
- A clear timeline and an honest cause, including "we are not sure yet".
- Updates were sent when promised.
- Follow-ups are specific and owned.
- No blame in the write-up.

## Ask the user first
Ask before deleting data, rotating shared keys, shutting down systems, or contacting customers. If personal data may have leaked, tell the user at once so they can involve legal.`,
	},
];
