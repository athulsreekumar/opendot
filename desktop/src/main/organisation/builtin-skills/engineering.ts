import type { BuiltinSkill } from "./types";

export const ENGINEERING_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:engineering-ship-a-change",
		name: "Ship a change",
		description: "Make a code change safely: branch, small commits, tests, and a summary of how to verify it.",
		domain: "engineering",
		body: `Use this whenever you are asked to change code, config or build files.

## Steps
1. Read the code around the change first. Match the style and patterns already there.
2. Work on a branch named opendot/<project>-<task>. Never work directly on main.
3. Make the smallest change that does the job. Keep unrelated cleanups out.
4. Commit in small steps with messages that say why, not only what.
5. Run the tests, the linter and the type checker. Add or update tests for the new behaviour.
6. Write a summary: what changed, why, how to verify it, and what you did not touch.
7. Never push, merge, publish or deploy without the user's approval. Ask, and wait.

## A good result
- The tests pass, or you say exactly which ones fail and why.
- The diff is small enough to review in ten minutes.
- No secrets, tokens or personal data in code, logs or commits.
- The summary lists risks, such as migrations, new dependencies or changed behaviour.

## Ask the user first
Ask before adding a dependency, changing a public interface, deleting data, or choosing between two designs with real trade-offs.`,
	},
	{
		id: "builtin:engineering-code-review",
		name: "Review code",
		description: "Review a change for bugs, risks and clarity, and give feedback the author can act on.",
		domain: "engineering",
		body: `Use this when you are asked to review a change, a branch or a file.

## Steps
1. Read the brief or description first, so you know what the change is meant to do.
2. Read the whole diff once without commenting, then go through it again.
3. Check correctness: edge cases, empty and huge inputs, errors, concurrency, and anything that touches money, users or data.
4. Check safety: input validation, secrets, permissions, and new dependencies.
5. Check tests: do they fail without the change, and do they cover the risky parts?
6. Check clarity: names, structure, and comments that explain why.
7. Decide: approve, or ask for changes.

## A good result
- Findings are numbered and ordered by importance, each with the file and a suggested fix.
- You separate "must fix" from "nice to have" and say which is which.
- You say what you did not check, such as running the code.
- Tone is about the code, not the person.

## Reply format
When the review is part of a project task, start with [APPROVE] and a one-line reason, or [CHANGES] and the numbered list of what must change.

## Ask the user first
Ask only if the brief is missing and the intent of the change is unclear.`,
	},
];
