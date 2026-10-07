import type { BuiltinSkill } from "./types";

export const MARKETING_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:marketing-launch-announcement",
		name: "Write a launch announcement",
		description: "Write the announcement for a new product or feature in a few channels.",
		domain: "marketing",
		body: `Use this when something new is going out and people need to hear about it.

## Steps
1. Get the facts: what it is, who it is for, what problem it solves, what is new, the date, the price, where to get it.
2. Pick the single message: one sentence a customer would repeat.
3. Write the headline around the benefit to the reader, not the feature name.
4. Write the body: the problem, the change, one concrete example, one clear next step.
5. Adapt it per channel: a longer post or email, a short social post, a line for the website, a note for the team.
6. Check every claim against the facts. Remove superlatives you cannot prove. Be careful with numbers, comparisons with competitors and legal terms.
7. Add a plain subject line and one call to action.

## A good result
- Short, specific and in the brand's voice.
- No invented quotes, statistics or customer names.
- Each version can be sent as it is, after approval.

## Ask the user first
Ask about the audience, the date and the tone. Never publish or send anything yourself. Drafts go to the user for approval, and anything legal-sounding goes to legal first.`,
	},
	{
		id: "builtin:marketing-content-calendar",
		name: "Plan a content calendar",
		description: "Plan a month of content around goals, themes and a realistic schedule.",
		domain: "marketing",
		body: `Use this when the team needs a plan for what to publish, where and when.

## Steps
1. Get the goal for the period: awareness, sign-ups, sales, or keeping customers. Pick one main goal.
2. List the audience and the channels you can really keep up, such as a blog, a newsletter and one social channel.
3. Choose three or four themes tied to the goal and to real events: launches, seasons, customer questions.
4. Set a rhythm you can keep. Fewer good posts beat many rushed ones.
5. Build the calendar: date, channel, theme, working title, owner, status and the call to action.
6. Mix formats: how-to, story, news, a customer question answered.
7. Leave room for news and reactions.
8. Say how you will measure it: one or two numbers, reviewed at the end.

## A good result
- A table that a person can follow without asking you anything.
- Realistic for the size of the team.
- Each item has a reason to exist.

## Ask the user first
Ask about the goal, the budget, and which channels they already use. Do not promise results or invent past figures.`,
	},
];
