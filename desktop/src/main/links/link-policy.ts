import type {
	AppSettings,
	Dot,
	DotId,
	DotLink,
	LinkApproval,
	LinkDecision,
	LinkId,
	LinkSubject,
} from "../../shared/types";
import { describeSchedule, isOpen } from "./schedule";

export interface LinkCounters {
	pairLastHour(from: DotId, to: DotId, now: Date): number;
	globalToday(now: Date): number;
}

export interface LinkPolicyInput {
	from: Dot;
	to: Dot;
	now: Date;
	rules: DotLink[];
	counters: LinkCounters;
	settings: AppSettings["links"];
	chain: DotId[];
}

export function subjectMatches(s: LinkSubject, d: Dot): boolean {
	switch (s.kind) {
		case "dot":
			return s.dotId === d.id;
		case "role":
			return d.roles.includes(s.role);
		case "super":
			return d.kind === "super";
		case "any":
			return true;
	}
}

function subjectScore(s: LinkSubject): number {
	switch (s.kind) {
		case "dot":
		case "super":
			return 2;
		case "role":
			return 1;
		case "any":
			return 0;
	}
}

function describeSubject(s: LinkSubject): string {
	switch (s.kind) {
		case "dot":
			return s.dotId;
		case "role":
			return `role ${s.role}`;
		case "super":
			return "SuperDot";
		case "any":
			return "any Dot";
	}
}

function deny(reason: string): LinkDecision {
	return { allowed: false, reason };
}

export function decideLink(input: LinkPolicyInput): LinkDecision {
	const { from, to, now, rules, counters, settings, chain } = input;
	if (from.id === to.id) return deny("A Dot can't message itself");
	if (to.archived) return deny("Target is archived");
	if (chain.includes(to.id)) {
		const nameOf = (id: DotId): string => (id === from.id ? from.name : id === to.id ? to.name : id);
		return deny(`Loop detected: ${[...chain, to.id].map(nameOf).join(" → ")}`);
	}
	if (chain.length >= settings.maxDepth) return deny("Too many hops");
	if (from.kind === "super" && to.hiddenFromSuper) return deny("Hidden from SuperDot");

	const candidates = rules
		.filter((r) => r.enabled && subjectMatches(r.from, from) && subjectMatches(r.to, to))
		.map((rule) => ({ rule, score: subjectScore(rule.from) + subjectScore(rule.to) }));
	if (candidates.length === 0) return deny(`No rule allows ${from.name} to message ${to.name}`);

	const max = Math.max(...candidates.map((c) => c.score));
	const top = candidates.filter((c) => c.score === max);
	const denyRule = top.find((c) => c.rule.effect === "deny");
	if (denyRule) {
		const r = denyRule.rule;
		return {
			allowed: false,
			ruleId: r.id,
			reason: `Blocked by a deny rule (${describeSubject(r.from)} → ${describeSubject(r.to)})`,
		};
	}

	const rank = (r: DotLink): [number, number, number] => [
		!r.schedule || isOpen(r.schedule, now) ? 0 : 1,
		r.approval === "auto" ? 0 : 1,
		Date.parse(r.createdAt) || 0,
	];
	const sorted = [...top].sort((a, b) => {
		const ra = rank(a.rule);
		const rb = rank(b.rule);
		return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
	});
	const rule = (sorted[0] as (typeof sorted)[number]).rule;

	if (rule.schedule && !isOpen(rule.schedule, now)) {
		return { allowed: false, ruleId: rule.id, reason: `Outside allowed hours (${describeSchedule(rule.schedule)})` };
	}
	if (counters.pairLastHour(from.id, to.id, now) >= rule.maxPerHour) {
		return { allowed: false, ruleId: rule.id, reason: `Rate limit reached (${rule.maxPerHour}/hour)` };
	}
	if (counters.globalToday(now) >= settings.globalDailyBudget) {
		return { allowed: false, ruleId: rule.id, reason: "Daily Dot-to-Dot budget used up" };
	}
	return {
		allowed: true,
		approval: rule.approval,
		ruleId: rule.id,
		reason: "Allowed",
		sharePii: rule.sharePii,
		purpose: rule.purpose,
	};
}

export function effectivePairs(
	dots: Dot[],
	rules: DotLink[],
	now: Date,
): Array<{ from: DotId; to: DotId; approval: LinkApproval; ruleId: LinkId }> {
	const counters: LinkCounters = { pairLastHour: () => 0, globalToday: () => 0 };
	const settings: AppSettings["links"] = {
		globalDailyBudget: Number.MAX_SAFE_INTEGER,
		maxDepth: Number.MAX_SAFE_INTEGER,
		replyTimeoutSec: 0,
	};
	const out: Array<{ from: DotId; to: DotId; approval: LinkApproval; ruleId: LinkId }> = [];
	for (const from of dots) {
		if (from.archived) continue;
		for (const to of dots) {
			const d = decideLink({ from, to, now, rules, counters, settings, chain: [] });
			if (d.allowed && d.approval && d.ruleId) {
				out.push({ from: from.id, to: to.id, approval: d.approval, ruleId: d.ruleId });
			}
		}
	}
	return out;
}
