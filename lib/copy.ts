// Copy deck (PLAN §5). Orchestrator-owned: sections import strings from here instead of hard-coding text.

export const GITHUB_URL = "https://github.com/athulsreekumar/opendot";

export const MAC_ONLY = {
	label: "For Mac and Windows",
	detail: "macOS 14+ · Windows 10 & 11",
};

export const nav = {
	links: [
		{ label: "Organisation", href: "/features/organisation" },
		{ label: "Features", href: "/features" },
		{ label: "SuperDot", href: "/features/superdot" },
		{ label: "Privacy", href: "/features/privacy" },
		{ label: "Guides", href: "/guides" },
	],
	cta: "GitHub",
};

export const hero = {
	h1: ["Your AI team.", "Living on your Mac."],
	lead: "OpenDot gives you Dots: AI assistants that each do one job brilliantly, work around the clock, and keep your data on your computer.",
	cta: "Get it on GitHub",
	build: "How to build it",
	film: "Watch the film",
	/** Announcement pill under the lead. Links to the Organisation section. */
	announce: { label: "New:", text: "OpenDot Organisation", href: "#organisation" },
	underVideo: "Real app. Real-time. No edits to the answers.",
};

export const statement =
	"Every Dot has a job, a personality, and only the access you give it. Together, they never sleep. Give each one a department and they work as a team.";

export const createDot = {
	eyebrow: "Create a Dot",
	h2: ["Describe it.", "It comes alive."],
	steps: [
		{ title: "Tell it what to do.", body: "“Watch my inbox and tell me what actually needs me.”" },
		{ title: "Pick what it can touch.", body: "Gmail, Calendar, a folder. Nothing else." },
		{
			title: "Meet your new Dot.",
			body: "OpenDot writes its name, look and personality, live, as you watch.",
		},
	],
};

export const alwaysOn = {
	eyebrow: "Always on",
	h2: ["Works while you don’t."],
	lead: "Dots run quietly in the background. The moment an email lands, a meeting moves or a file changes, the right Dot already knows. It only taps you when it matters.",
	badges: ["[URGENT]", "[UPDATE]", "stays quiet"],
	footnote: "Budgets you set keep every Dot in check.",
	events: [
		{ source: "Gmail", title: "Invoice overdue: Northwind Labs", dot: "Money" },
		{ source: "Calendar", title: "Board sync moved to 9:30", dot: "Calendar" },
		{ source: "Drive", title: "Q3 deck edited by Leo Park", dot: "Inbox" },
	],
};

export const superBot = {
	eyebrow: "SuperDot",
	h2: ["One question.", "Every Dot."],
	lead: "Ask SuperDot anything. It knows which Dots know what, asks them all at once, and hands you one answer with sources. It can also manage a project across your team.",
	question: "What do I need to prepare for tomorrow?",
	dots: ["Inbox", "Calendar", "Research", "Money", "Travel"],
	/** What each Dot can do: the second ring of the tree. */
	capabilities: {
		Inbox: ["Gmail", "Triage", "Draft replies", "Follow-ups"],
		Calendar: ["Google Calendar", "Mac Calendar", "Free time", "Reschedule"],
		Research: ["Web pages", "Summaries", "Sources", "Saved notes"],
		Money: ["Receipts", "Subscriptions", "Invoices", "Budgets"],
		Travel: ["Flights", "Itineraries", "Check-in", "Passport"],
	} as Record<string, string[]>,
};

/** A department Dot as shown in the Organisation section. Jobs are the one-liners the app uses. */
export type OrgDept = { id: string; emoji: string; name: string; job: string };

export const orgDepartments: OrgDept[] = [
	{ id: "engineering", emoji: "🛠️", name: "Engineering", job: "Builds and fixes software" },
	{ id: "product", emoji: "🧭", name: "Product", job: "Decides what to build and why" },
	{ id: "design", emoji: "🎨", name: "Design", job: "Shapes how it looks and feels" },
	{ id: "security", emoji: "🛡️", name: "Security", job: "Finds risks and keeps data safe" },
	{ id: "it", emoji: "🖥️", name: "IT", job: "Keeps systems, accounts and devices running" },
	{ id: "data", emoji: "📊", name: "Data", job: "Turns numbers into answers" },
	{ id: "hr", emoji: "🌱", name: "HR", job: "Hires, onboards and looks after people" },
	{ id: "admin", emoji: "🗂️", name: "Admin", job: "Keeps the office running smoothly" },
	{ id: "finance", emoji: "💰", name: "Finance", job: "Watches budgets, invoices and costs" },
	{ id: "legal", emoji: "⚖️", name: "Legal", job: "Reads contracts and spots legal risks" },
	{ id: "marketing", emoji: "📣", name: "Marketing", job: "Tells people what you make" },
	{ id: "sales", emoji: "💼", name: "Sales", job: "Finds and looks after customers" },
	{ id: "support", emoji: "🎧", name: "Support", job: "Helps customers and answers questions" },
];

export const organisation = {
	id: "organisation",
	eyebrow: "OpenDot Organisation",
	h2: ["An organisation.", "Run by Dots."],
	lead: "Give SuperDot a project and it acts as your project manager. It writes the plan, hands each task to the right department Dot (Engineering, Product, Design, Security, Finance, HR and more), and reports back when the work is done.",
	learnMore: { href: "/features/organisation", label: "Learn more about OpenDot Organisation" },
	stats: [
		{ value: "13", label: "departments" },
		{ value: "4", label: "team templates" },
		{ value: "28", label: "built-in playbooks" },
	],
	example: "Illustrated example. The app screenshots are real.",
	inApp: "In the app",
	/** The five beats of the storyboard, in order. */
	beats: [
		{
			id: "ask",
			label: "Ask",
			title: "Tell SuperDot what you need.",
			body: "Type a request in plain words, the way you would message a colleague. No forms and no tickets.",
		},
		{
			id: "plan",
			label: "Plan",
			title: "SuperDot writes the plan.",
			body: "It breaks the request into tasks. Each task has one owner, the tasks it waits for and a reviewer. Edit anything. Nothing runs until you approve.",
		},
		{
			id: "split",
			label: "Split",
			title: "Departments work in parallel.",
			body: "Tasks that do not depend on each other start together, up to three at a time by default. Each Dot uses its own skills and only the access you gave it.",
		},
		{
			id: "review",
			label: "Review",
			title: "Work is reviewed before it counts.",
			body: "A reviewer Dot checks the result and can ask for changes. A Dot can stop and ask you a question. Tasks that need your yes wait for it.",
		},
		{
			id: "done",
			label: "Delivered",
			title: "You get the board and a report.",
			body: "Files the Dots made are listed as deliverables. SuperDot finishes with a report of what was done, where it is and what still needs you.",
		},
	],
	ask: {
		request: "Add single sign-on for our customers.",
		reply: "Planning “Customer single sign-on”. Open Organisation to review the plan.",
		to: "SuperDot",
	},
	plan: {
		title: "Customer single sign-on",
		note: "Five tasks. Product writes the requirements first. Design, Engineering and Support can then work at the same time.",
		ownerLabel: "Owner",
		reviewerLabel: "Reviewer",
		afterLabel: "after",
		approve: "Approve and start",
		replan: "Ask SuperDot to replan",
		/** deps are task numbers; owner and reviewer are department names (or "You"). */
		tasks: [
			{
				n: 1,
				short: "Requirements",
				title: "Write the requirements",
				owner: "Product",
				after: [] as number[],
				reviewer: "Engineering",
			},
			{ n: 2, short: "Screens", title: "Design the sign-in screens", owner: "Design", after: [1], reviewer: "Product" },
			{ n: 3, short: "Build", title: "Build single sign-on", owner: "Engineering", after: [1], reviewer: "Security" },
			{
				n: 4,
				short: "Help article",
				title: "Write the help article",
				owner: "Support",
				after: [1],
				reviewer: "Product",
			},
			{
				n: 5,
				short: "Announcement",
				title: "Draft the customer announcement",
				owner: "Marketing",
				after: [3],
				reviewer: "You",
			},
		],
	},
	split: {
		center: "SuperDot",
		/** Departments shown in the diagram, in order around the centre. */
		nodes: ["Product", "Design", "Engineering", "Security", "Support", "Marketing"],
		more: "and 7 more departments you can add",
		running: "Running in parallel",
		legend: ["Waiting", "Working", "Done"],
		sr: "SuperDot sends task 1 to Product. When it is done, tasks 2, 3 and 4 go to Design, Engineering and Support at the same time. Security reviews Engineering’s work, and Marketing drafts the announcement once the build is done.",
	},
	review: {
		title: "Build single sign-on",
		owner: "Engineering",
		reviewer: "Security",
		round1: { status: "Changes requested", notes: ["Sessions need an expiry time.", "Log failed sign-ins."] },
		revised: "Engineering revised the change.",
		round2: { status: "Approved", note: "Both points are fixed." },
		waiting: {
			label: "Waiting for you",
			title: "Draft the customer announcement",
			from: "Marketing",
			approve: "Approve",
			changes: "Request changes",
		},
	},
	done: {
		columns: ["To do", "In progress", "In review", "Done"],
		doneTitles: [
			"Write the requirements",
			"Design the sign-in screens",
			"Build single sign-on",
			"Write the help article",
			"Draft the customer announcement",
		],
		reportLabel: "Report from SuperDot",
		report:
			"All 5 tasks are done. The requirements, sign-in screens, the single sign-on change, a help article and an announcement draft are in your deliverables. Security approved the build after one round of changes. Nothing was sent or published.",
		deliverablesLabel: "Deliverables",
		deliverables: [
			"requirements.md",
			"sign-in-screens.md",
			"sso-change-notes.md",
			"help-article.md",
			"announcement-draft.md",
		],
	},
	shots: {
		chat: "SuperDot’s chat in OpenDot with a request for a project and a card that says the plan is ready to review.",
		plan: "The plan SuperDot wrote in OpenDot: a list of tasks with owners, dependencies and reviewers, ready to edit and approve.",
		drawer: "A task drawer in OpenDot showing the task’s result, its deliverables and the reviewer’s decision.",
		board:
			"The project board in OpenDot with columns To do, In progress, In review and Done, and a card for each task.",
		summary: "SuperDot’s final report on a finished project in OpenDot, listing what was delivered and what needs you.",
		setup:
			"OpenDot’s Organisation set-up screen with four team templates: Startup, Software team, Small business and Full.",
		team: "The Team tab in OpenDot: one Dot per department, each with its skills.",
		skills: "The Skills library in OpenDot: built-in playbooks grouped by department, with an editor for your own.",
	},
	wall: {
		eyebrow: "Departments",
		title: "Thirteen departments. Pick the ones you need.",
		lead: "Each department is a Dot with its own persona, skills and access. Start from a template or tick domains one by one. Add or remove a department any time.",
		templatesTitle: "Start from a template",
		templates: [
			{ name: "Startup", domains: "Engineering, product, design, security, marketing, finance, admin", count: 7 },
			{ name: "Software team", domains: "Engineering, product, design, security, IT, data", count: 6 },
			{ name: "Small business", domains: "Admin, finance, HR, sales, marketing, support, legal", count: 7 },
			{ name: "Full organisation", domains: "All thirteen departments", count: 13 },
		],
		dotsLabel: "Dots",
		note: "Add or remove departments any time. You can also bring in a Dot you already have.",
		setupCap: "Pick a template and create your team.",
		teamCap: "One Dot per department, each with its skills.",
	},
	control: {
		eyebrow: "In control",
		title: "You stay the boss.",
		items: [
			{
				title: "You approve the plan first",
				body: "Edit the tasks, owners, order and reviewers. Nothing runs until you press Approve and start.",
			},
			{
				title: "Reviews before anything counts as done",
				body: "A reviewer Dot checks each task. If it asks for changes, the owner revises. After two rounds by default, the task comes to you.",
			},
			{
				title: "Budgets, pause, approvals and masking still apply",
				body: "Set a budget for a project, pause or cancel any time. Risky actions still wait for your yes. Dot Links rules and PII masking apply as always.",
			},
		],
	},
	skills: {
		eyebrow: "Skills",
		title: "Playbooks for every department, yours to edit.",
		body: "Each department Dot starts with built-in skills: step-by-step playbooks such as shipping a change, reviewing a contract or triaging a ticket. Edit one and OpenDot saves your own copy. Add skills for how your team works.",
		examples: [
			"Ship a change",
			"Threat review",
			"Write a PRD",
			"Contract review",
			"Onboarding checklist",
			"Triage a ticket",
		],
		note: "28 built-in playbooks, plus your own.",
	},
	cta: {
		title: "Local, open source and yours to build.",
		body: "Works with any model. Everything stays on your computer, and cloud models only see what masking allows.",
		github: "Get it on GitHub",
		how: "See how it works",
		href: "/features/organisation",
	},
};

export const dotLinks = {
	eyebrow: "Dot Links",
	h2: ["You decide who talks to whom."],
	lead: "Let your Travel Dot ask your Calendar Dot, but only on weekdays, only five times an hour, and only if you approve. Every message is logged.",
};

export const privacy = {
	eyebrow: "Privacy",
	h2: ["Your data stays home."],
	points: [
		"Everything lives in ~/.opendot on your computer, in plain files you can read.",
		"Emails, phone numbers and card details are masked before anything reaches a cloud model.",
		"Anything that changes the world, like sending, deleting or paying, asks you first.",
		"Your keys are encrypted by your operating system.",
	],
	demo: { before: "maya.chen@example.com", after: "⟦EMAIL_1⟧" },
};

export const anyModel = {
	eyebrow: "Any model",
	h2: ["Any model.", "Even the one on your Mac."],
	lead: "Use Claude, GPT, Gemini, Grok and more, or run fully local with Ollama or LM Studio. Switch per Dot.",
	rowA: ["Claude", "GPT", "Gemini", "Grok", "Mistral", "DeepSeek", "Llama", "Qwen"],
	rowB: ["Ollama", "LM Studio", "OpenRouter", "Groq", "llama.cpp", "vLLM", "Any URL"],
	trio: ["Cloud", "On your Mac", "Any URL"],
};

export const connections = {
	eyebrow: "Connections",
	h2: ["Plugs into everything."],
	lead: "Google Workspace, Microsoft 365, your Mac’s Calendar, Reminders, Notes and files. Plus unlimited MCP servers.",
	tiles: [
		{ title: "Google Workspace", body: "Gmail, Calendar, Drive" },
		{ title: "Microsoft 365", body: "Outlook, Calendar, OneDrive, Teams" },
		{ title: "Your Mac", body: "Calendar, Reminders, Contacts, Notes, files" },
		{ title: "MCP servers", body: "Unlimited. Local or remote." },
		{ title: "Webhooks", body: "Anything that can send a request" },
		{ title: "Folders & the web", body: "Watch files, pages and feeds" },
	],
};

export const streaming = {
	eyebrow: "Streaming",
	h2: ["Answers from the first word."],
	lead: "No spinners. Every reply streams in as it’s written, even from Dots working in the background.",
	demoQuestion: "Summarise my week.",
	demoAnswer:
		"Here’s your week at a glance:\n\n• 3 meetings moved. Calendar already re-shuffled your focus blocks.\n• Northwind’s invoice is 4 days overdue. A polite reminder is drafted.\n• Your flight to Lisbon on Friday is on time; check-in opens tomorrow at 9:00.\n\nWant me to send the reminder?",
};

export const openSource = {
	eyebrow: "Open source",
	h2: ["Open source.", "Built in the open."],
	lead: "MIT-licensed, built on the pi agent harness. Read every line, run your own build.",
	link: "View on GitHub",
};

export const finalCta = {
	h2: ["Yours to build."],
	lead: "OpenDot is free and open source. Grab the code on GitHub, build it for your Mac or PC in a few minutes, and meet your first Dot.",
	cta: "Get it on GitHub",
	build: "Build steps",
};

export const form = {
	emailLabel: "Email",
	emailPlaceholder: "you@example.com",
	firstDotLabel: "What would your first Dot do?",
	firstDotPlaceholder: "Optional, e.g. “Keep an eye on my inbox”",
	macLabel: "Your Mac",
	macOptions: [
		{ value: "apple-silicon", label: "Apple silicon" },
		{ value: "intel", label: "Intel" },
		{ value: "unsure", label: "Not sure" },
	],
	submit: "Get early access",
	success: "You’re on the list. We’ll be in touch.",
	duplicate: "You’re already on the list. We’ll be in touch.",
	error: "Something went wrong. Please try again in a minute.",
	invalid: "Please enter a valid email address.",
	rate: "Too many tries. Please wait a few minutes.",
	consent: "We’ll only email you about OpenDot.",
	privacyLink: "Privacy",
};

export const footer = {
	tagline: "Made for Mac and Windows.",
	links: [
		{ label: "Download", href: "/download" },
		{ label: "Privacy policy", href: "/privacy" },
		{ label: "GitHub", href: GITHUB_URL },
	],
	columns: [
		{
			title: "Features",
			links: [
				{ label: "OpenDot Organisation", href: "/features/organisation" },
				{ label: "SuperDot", href: "/features/superdot" },
				{ label: "Private by default", href: "/features/privacy" },
				{ label: "Always on", href: "/features/always-on" },
				{ label: "Any model", href: "/features/any-model" },
				{ label: "Connections and MCP", href: "/features/connections" },
			],
		},
		{
			title: "Guides",
			links: [
				{ label: "Run a project with an AI team", href: "/guides/run-a-project-with-ai-team" },
				{ label: "Local AI with Ollama", href: "/guides/local-ai-assistant-mac-ollama" },
				{ label: "AI email assistant for Gmail", href: "/guides/ai-email-assistant-gmail" },
				{ label: "MCP servers on Mac", href: "/guides/mcp-servers-mac" },
			],
		},
	],
};

export const faq = {
	h2: "Questions? Answers.",
	items: [
		{
			q: "What is OpenDot?",
			a: "OpenDot is a Mac and Windows app that gives you a team of AI assistants called Dots. Each Dot has one job, a personality, and only the access you give it. They run in the background, watch your email, calendar and files, and tell you when something needs you.",
		},
		{
			q: "Is OpenDot free?",
			a: "Yes. OpenDot is free and open source under the MIT license. If you connect a cloud model such as Claude or GPT with your own API key, that provider bills you directly. Run a local model through Ollama or LM Studio and it costs nothing.",
		},
		{
			q: "Which computers does it run on?",
			a: "OpenDot runs on macOS 14 or later, on both Apple silicon and Intel Macs, and on Windows 10 and 11 (x64). On Windows everything works except the Mac-only Calendar, Reminders, Contacts and Notes tools; use Google Workspace or Microsoft 365 for those.",
		},
		{
			q: "Does my data leave my computer?",
			a: "Not by default. Everything lives in ~/.opendot on your computer, in plain files you can read. Emails, phone numbers and card details are masked before anything reaches a cloud model, your keys are encrypted by macOS or Windows, and any action that changes something, like sending, deleting or paying, asks you first.",
		},
		{
			q: "Which AI models can I use, and does it work offline?",
			a: "Claude, GPT, Gemini, Grok, Mistral, DeepSeek, OpenRouter and Groq, or local models through Ollama, LM Studio, llama.cpp and vLLM. Any compatible URL works too, and you can pick a different model for each Dot. With a local model a Dot's thinking never leaves your computer, though Dots that read Gmail, Outlook or other online services still need a connection to reach them.",
		},
		{
			q: "What is a Dot?",
			a: "A Dot is a single-purpose AI assistant. You describe what it should do in plain English, choose what it can touch, such as Gmail, Calendar or a folder, and OpenDot gives it a name, a look and a personality. Dots run 24/7 and react to new email, calendar changes, files and webhooks.",
		},
		{
			q: "What is SuperDot?",
			a: "SuperDot is the assistant that sits above your Dots. Ask it one question, such as what you need to prepare for tomorrow. It asks the right Dots at once, combines their answers and shows you the sources.",
		},
		{
			q: "What is OpenDot Organisation?",
			a: "OpenDot Organisation lets you run a team of Dots like a small company. You set up one Dot per department, such as Engineering, Product, Security, Finance or HR, from a template or one at a time. You then ask SuperDot for a project. It writes a plan, you approve it, and the department Dots do the work, review each other and report back. It is built into the app and free.",
		},
		{
			q: "Can SuperDot really manage a project across Dots?",
			a: "Yes, within limits. SuperDot writes a plan of tasks, each with an owner, dependencies and a reviewer, and you can edit and approve it before anything runs. Tasks go to the Dots through Dot Links, so your rules, budgets and approvals apply, and risky actions still wait for you. How good the result is depends on the models you choose, so check the work before you rely on it.",
		},
		{
			q: "Does it cost extra or send my data anywhere?",
			a: "It costs nothing extra. Organisation is part of OpenDot, which is free and open source, and it runs on your computer. If you use a cloud model with your own API key, that provider bills you and only sees what PII masking allows. With a local model, the thinking stays on your computer. You can also set a budget for each project.",
		},
		{
			q: "Can Dots talk to each other safely?",
			a: "Yes, with Dot Links. You decide which Dots can message which, with role-based access, schedules, rate limits and approvals. For example, your Travel Dot can ask your Calendar Dot only on weekdays, five times an hour, and only if you approve. Every message is logged.",
		},
		{
			q: "How do I get OpenDot?",
			a: "OpenDot is free on GitHub. Clone the repository, then in the desktop folder run npm ci and npm run dev to try it, or npm run dist:mac:arm64 (Apple silicon) or npm run dist:mac:x64 (Intel) to build the Mac app, or npm run dist:win to build the Windows installer. You need macOS 14 or later or Windows 10 or 11, plus Node.js 22.19 or later.",
		},
		{
			q: "Is OpenDot open source?",
			a: "Yes. OpenDot is MIT-licensed and built on the pi agent harness, so you can read every line, change it and run your own build.",
		},
	],
};

export const meta = {
	title: "OpenDot: your AI team, living on your Mac",
	description: hero.lead,
};
