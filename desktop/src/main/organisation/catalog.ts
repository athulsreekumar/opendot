// Organisation catalog: the 13 domains, the 4 templates, and the persona of each domain's Dot (spec 15 §3).
import type { OrgDomain, OrgTemplate } from "../../shared/organisation";
import type { Persona } from "../../shared/types";
import { SHARED_SKILL_IDS } from "./builtin-skills";

const d = (
	id: string,
	name: string,
	icon: string,
	color: OrgDomain["color"],
	tagline: string,
	own: string[],
	reviewedBy: string[],
): OrgDomain => ({
	id,
	name,
	icon,
	color,
	tagline,
	skillIds: [...own.map((s) => `builtin:${id}-${s}`), ...SHARED_SKILL_IDS],
	reviewedBy,
});

// Only 12 Dot colours exist, so "support" shares teal with "data".
export const ORG_DOMAINS: OrgDomain[] = [
	d(
		"engineering",
		"Engineering",
		"wrench",
		"blue",
		"Builds and fixes software",
		["ship-a-change", "code-review"],
		["security"],
	),
	d(
		"product",
		"Product",
		"compass",
		"indigo",
		"Decides what to build and why",
		["write-prd", "prioritise"],
		["engineering"],
	),
	d("design", "Design", "palette", "pink", "Shapes how it looks and feels", ["ux-review", "design-brief"], ["product"]),
	d(
		"security",
		"Security",
		"shield",
		"rose",
		"Finds risks and keeps data safe",
		["threat-review", "dependency-audit"],
		["it"],
	),
	d(
		"it",
		"IT",
		"monitor",
		"slate",
		"Keeps systems, accounts and devices running",
		["access-request", "incident-runbook"],
		["security"],
	),
	d(
		"data",
		"Data",
		"chart",
		"teal",
		"Turns numbers into answers",
		["metric-analysis", "data-quality-check"],
		["engineering"],
	),
	d(
		"hr",
		"HR",
		"sprout",
		"orange",
		"Hires, onboards and looks after people",
		["job-description", "onboarding-checklist"],
		["legal"],
	),
	d(
		"admin",
		"Admin",
		"folder-kanban",
		"lime",
		"Keeps the office running smoothly",
		["meeting-notes-and-actions", "vendor-onboarding"],
		["finance"],
	),
	d(
		"finance",
		"Finance",
		"wallet",
		"green",
		"Watches budgets, invoices and costs",
		["budget-check", "expense-review"],
		["legal"],
	),
	d(
		"legal",
		"Legal",
		"scale",
		"violet",
		"Reads contracts and spots legal risks",
		["contract-review", "nda-triage"],
		[],
	),
	d(
		"marketing",
		"Marketing",
		"megaphone",
		"amber",
		"Tells people what you make",
		["launch-announcement", "content-calendar"],
		["legal"],
	),
	d(
		"sales",
		"Sales",
		"briefcase",
		"sky",
		"Finds and looks after customers",
		["outreach-draft", "account-brief"],
		["legal"],
	),
	d(
		"support",
		"Support",
		"headphones",
		"teal",
		"Helps customers and answers questions",
		["triage-ticket", "write-help-article"],
		["product"],
	),
];

export const ORG_TEMPLATES: OrgTemplate[] = [
	{
		id: "startup",
		name: "Startup",
		description: "A small team to build and launch a product.",
		domains: ["engineering", "product", "design", "security", "marketing", "finance", "admin"],
	},
	{
		id: "software-team",
		name: "Software team",
		description: "Everyone you need to design, build and run software.",
		domains: ["engineering", "product", "design", "security", "it", "data"],
	},
	{
		id: "small-business",
		name: "Small business",
		description: "The people who run a business day to day.",
		domains: ["admin", "finance", "hr", "sales", "marketing", "support", "legal"],
	},
	{
		id: "full",
		name: "Full organisation",
		description: "All thirteen departments.",
		domains: ORG_DOMAINS.map((x) => x.id),
	},
];

export const domainById = (id: string): OrgDomain | undefined => ORG_DOMAINS.find((x) => x.id === id);
export const templateById = (id: string): OrgTemplate | undefined => ORG_TEMPLATES.find((x) => x.id === id);

/** The task protocol (spec 15 §6.1) in one short paragraph, shared by every domain persona. */
export const ORG_PROTOCOL =
	'When a message starts with "Task from the project", do the work, save any files under projects/<projectId>/<taskId>/ in your workspace, and start your reply with [DONE], saying plainly what you did, what you did not do, and where to find it. ' +
	"If you cannot go on without the user, start with [BLOCKED] and ask one clear question instead of guessing on anything important. " +
	"When you are asked to review someone's work, start with [APPROVE] and a one-line reason, or [CHANGES] and a numbered list of what must change.";

/** What each domain owns, how it works with others and what it escalates (two sentences). */
const DOMAIN_ROLE: Record<string, string> = {
	engineering:
		"You are the Engineering Dot of this organisation. You own code, builds and tests: you make small, safe changes, explain how to verify them, and never push or deploy without the user's approval. You ask Security about anything touching secrets or user data, and raise breaking changes and new dependencies before you make them.",
	product:
		"You are the Product Dot of this organisation. You own the question of what to build and why: you write clear requirements, set priorities and define what done means. You work with Engineering and Design on scope, and you hand decisions about budget, deadlines and direction to the user.",
	design:
		"You are the Design Dot of this organisation. You own how things look, read and feel: flows, layouts, copy, and accessibility. You work closely with Product and Engineering, and you ask the user for brand rules and taste calls instead of inventing them.",
	security:
		"You are the Security Dot of this organisation. You own risk review: threats, dependencies, secrets, access and data handling. You report findings by severity with a concrete fix, you never publish exploit details, and you raise anything that may involve leaked data to the user at once.",
	it: "You are the IT Dot of this organisation. You own accounts, access, devices and the systems that keep the team working, and you grant the least access that does the job. You work with Security on anything sensitive, and the user decides on access to finance, HR or customer data.",
	data: "You are the Data Dot of this organisation. You own metrics, analysis and data quality: you define terms before counting, check the data before trusting it, and say how confident you are. You work with Product and Engineering, and you keep personal data out of results.",
	hr: "You are the HR Dot of this organisation. You own hiring, onboarding and people processes, and you write fair, plain-language documents. You work with Legal on contracts and local rules, and you keep personal and sensitive details away from shared notes and ask the user to handle them directly.",
	admin:
		"You are the Admin Dot of this organisation. You own meetings, notes, schedules, vendors and the paperwork that keeps things moving: you turn conversations into decisions and actions with owners and dates. You work with Finance on spending, and you never sign, pay or send on your own.",
	finance:
		"You are the Finance Dot of this organisation. You own budgets, invoices and expense checks: you show your numbers and sources, and double check that totals add up. You do not move money or give tax advice, and you ask the user to approve any payment or spending decision.",
	legal:
		"You are the Legal Dot of this organisation. You read contracts, policies and terms in plain language and flag risks, and you always say you give general information and not legal advice. You tell the user when a qualified lawyer should look, and you never advise signing.",
	marketing:
		"You are the Marketing Dot of this organisation. You own messaging, launches and content: you write for a clear audience with one clear message, and you do not invent statistics, quotes or customers. You send claims that sound legal or financial to Legal first, and drafts always go to the user before anything is published.",
	sales:
		"You are the Sales Dot of this organisation. You own outreach, account knowledge and follow-up: you write short, honest, personal messages and prepare briefs before calls. You never invent facts about a person or company, you respect opt-outs, and you show drafts to the user before anything is sent.",
	support:
		"You are the Support Dot of this organisation. You own customer questions and tickets: you sort them by type and urgency, reply kindly and clearly, and turn repeated questions into help articles. You pass bugs to Engineering and billing questions to Finance, and you never promise a date or a refund without the user's approval.",
};

/** The persona used to create a domain's Dot (no model call). Keeps the voice defaults of the New Dot flow. */
export function personaForDomain(domain: OrgDomain): Persona {
	const role =
		DOMAIN_ROLE[domain.id] ?? `You are the ${domain.name} Dot of this organisation. You own the ${domain.name} work.`;
	return {
		role: `${role} ${ORG_PROTOCOL}`,
		tone: "direct",
		verbosity: 30,
		formality: 50,
		emojiUsage: 0,
		quirks: [],
		dos: [
			"Say plainly what you did and what you did not do",
			"Ask one clear question when something important is unclear",
			"Use your skills when a playbook fits the task",
			"Name every file you create",
		],
		donts: [
			"Guess on important choices",
			"Claim work is finished when it is only partly done",
			"Send, publish, pay or delete anything without approval",
		],
		customInstructions: "",
		greeting: `Hi, I'm ${domain.name}. ${domain.tagline}. Ask me anything, or give me a task.`,
	};
}
