import type { BuiltinSkill } from "./types";

export const DESIGN_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:design-ux-review",
		name: "Review a user experience",
		description: "Review a screen or flow for clarity, effort, accessibility and consistency.",
		domain: "design",
		body: `Use this when you are asked to critique a screen, a flow, a prototype or a page.

## Steps
1. Find out who the user is and what they are trying to do. Judge the design against that task.
2. Walk the flow as a first-time user. Count the steps and the decisions.
3. Check clarity: is the main action obvious, are labels plain words, is anything surprising?
4. Check states: empty, loading, error, success, long text, small screens.
5. Check accessibility: contrast, text size, keyboard use, focus order, meaningful labels, not relying on colour alone.
6. Check consistency with the rest of the product: spacing, components, wording.
7. Rank what you found by how much it hurts the user.

## A good result
- A short list, most important first, each with what is wrong, why it matters and a concrete fix.
- A note on what already works well, so it is not broken later.
- You say what you could not judge, such as real usage.

## Ask the user first
Ask who the users are and what the goal of the flow is, if the brief does not say. Do not redesign the whole product when asked for a review.`,
	},
	{
		id: "builtin:design-design-brief",
		name: "Write a design brief",
		description: "Capture goals, audience, constraints and deliverables before design work starts.",
		domain: "design",
		body: `Use this at the start of any design task, or when a request is too loose to design from.

## Steps
1. State the goal in one sentence: what should a person be able to do or feel after this?
2. Describe the audience: who they are, what they know, where they will see it.
3. List the required content and actions, in order of importance.
4. Note constraints: brand rules, existing components, platforms, accessibility needs, deadline.
5. Collect references: things to match and things to avoid, with a line on why.
6. Define the deliverables: sketches, a clickable flow, final assets, a spec for developers.
7. Say how the result will be judged, and who gives feedback.

## A good result
- One page, written in plain words.
- A designer who has never seen the project could start from it.
- Open questions are listed, not guessed.
- It says what is not part of this round.

## Ask the user first
Ask for the audience, the one action that matters most, and any brand material. If none exists, say you will propose a simple direction and ask them to confirm it.`,
	},
];
