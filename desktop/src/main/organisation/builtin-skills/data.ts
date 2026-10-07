import type { BuiltinSkill } from "./types";

export const DATA_SKILLS: BuiltinSkill[] = [
	{
		id: "builtin:data-metric-analysis",
		name: "Analyse a metric",
		description:
			"Answer a question with data: define the metric, check the data, find the drivers, state the confidence.",
		domain: "data",
		body: `Use this when someone asks "why did X change?" or "how are we doing on X?".

## Steps
1. Restate the question and define the metric exactly: what is counted, over what period, for whom.
2. Find the data and check where it comes from. Note its date range and any known gaps.
3. Look at the trend first, then split it: by time, segment, channel, product or region. Find where the change concentrates.
4. Compare with something fair: the previous period, the same period last year, a control group.
5. Check for boring explanations: a tracking change, a holiday, a one-off event, a small sample.
6. State what the data supports and what it does not. Separate facts from guesses.
7. Suggest one or two next steps.

## A good result
- The answer comes first, then the evidence, then the caveats.
- Numbers have units, dates and the size of the sample.
- Any chart or table has a plain title that says the finding.
- You say how confident you are, and why.

## Ask the user first
Ask which definition of the metric they mean, and which decision this will inform. Do not share personal data in results; use counts and groups.`,
	},
	{
		id: "builtin:data-data-quality-check",
		name: "Check data quality",
		description: "Check a dataset for missing, duplicate, wrong or stale values before anyone relies on it.",
		domain: "data",
		body: `Use this before analysing or sharing a dataset you did not create, or when numbers look wrong.

## Steps
1. Learn what each column should mean and what type and range it should have.
2. Count rows and compare with what you expected.
3. Check missing values per column, and whether they are random or concentrated.
4. Check duplicates: whole rows and the key that should be unique.
5. Check ranges and formats: negative amounts, dates in the future, impossible ages, mixed units, odd text encodings.
6. Check consistency between columns and with other sources, such as totals that should match.
7. Check freshness: when was the latest row added?
8. Summarise the problems by how much they could change the answer.

## A good result
- A short list of issues with counts and examples (without personal data), plus a recommendation: use as is, clean first, or do not use.
- Cleaning steps are written down so they can be repeated.
- You never change the original data. Work on a copy.

## Ask the user first
Ask before dropping rows or filling gaps. Say how many rows would be affected.`,
	},
];
