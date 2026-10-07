import type { BuiltinSkill } from "./types";

export const SECURITY_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:security-threat-review",
		name: "Review a design for threats",
		description: "Find what could go wrong in a feature or system and what to do about it.",
		domain: "security",
		body: `Use this when a feature handles logins, personal data, money, files, or anything exposed to the internet.

## Steps
1. Describe the system in a few lines: parts, data it holds, who uses it, where it talks to others.
2. List the valuable things: accounts, personal data, money, keys, reputation.
3. Walk each entry point and ask what a careless user, a curious outsider or a hostile one could do.
4. Check the basics: authentication, who may do what, input validation, secrets storage, logging, encryption in transit and at rest, rate limits.
5. For each risk, note how likely and how bad it is, then pick a fix: remove, reduce, accept or watch.
6. Sort by severity. Mark what must be fixed before release.

## A good result
- A numbered list of risks, each with the scenario in one sentence and a specific fix.
- Severity is stated honestly: high, medium or low, with the reason.
- You say what you did not review.
- No exploit instructions, only what is needed to fix the problem.

## Reply format
When asked to review as part of a project, start with [APPROVE] and a reason, or [CHANGES] and the must-fix list.

## Ask the user first
Ask what data is stored and who can reach the system, if the brief does not say.`,
	},
	{
		id: "builtin:security-dependency-audit",
		name: "Audit dependencies",
		description: "Check the libraries a project uses for known problems, old versions and risky licences.",
		domain: "security",
		body: `Use this when asked to check the health of a project's libraries, or before a release.

## Steps
1. Find the dependency files (package.json, lock files, requirements, go.mod, and so on) and list direct dependencies.
2. Run the ecosystem's own audit command if you have shell access and approval (for example npm audit). Do not install new tools without asking.
3. For each finding, note the package, the version, the problem, whether a fixed version exists and whether the vulnerable code is actually used.
4. Flag packages that are abandoned, have a single unknown maintainer, or were added recently without a clear reason.
5. Check licences for anything that does not fit how the project is distributed.
6. Recommend the smallest safe updates first. Group risky major upgrades separately.

## A good result
- A short table or list: package, issue, severity, fix.
- A clear split between "fix now", "fix soon" and "fine for now".
- You never upgrade or install anything without approval.
- You state when the audit tool could not run.

## Ask the user first
Ask before changing any lock file or upgrading a major version.`,
	},
];
