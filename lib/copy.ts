// Copy deck (PLAN §5). Orchestrator-owned: sections import strings from here instead of hard-coding text.

export const GITHUB_URL = "https://github.com/athulsreekumar/opendot";

export const MAC_ONLY = {
	label: "Only available for Mac",
	detail: "macOS 14+ · Apple silicon & Intel",
};

export const nav = {
	links: [
		{ label: "Features", href: "/features" },
		{ label: "SuperDot", href: "/features/superdot" },
		{ label: "Privacy", href: "/features/privacy" },
		{ label: "Guides", href: "/guides" },
	],
	cta: "Get early access",
};

export const hero = {
	h1: ["Your AI team.", "Living on your Mac."],
	lead: "OpenDot gives you Dots: AI assistants that each do one job brilliantly, work around the clock, and keep your data on your Mac.",
	cta: "Get early access",
	film: "Watch the film",
	underVideo: "Real app. Real-time. No edits to the answers.",
};

export const statement =
	"Every Dot has a job, a personality, and only the access you give it. Together, they never sleep.";

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
	lead: "Ask SuperDot anything. It knows which Dots know what, asks them all at once, and hands you one answer with sources.",
	question: "What do I need to prepare for tomorrow?",
	dots: ["Inbox", "Calendar", "Research", "Money", "Travel"],
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
		"Everything lives in ~/.opendot on your Mac, in plain files you can read.",
		"Emails, phone numbers and card details are masked before anything reaches a cloud model.",
		"Anything that changes the world, like sending, deleting or paying, asks you first.",
		"Your keys are locked in the macOS Keychain.",
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
	h2: ["Be first in line."],
	lead: "OpenDot is coming to the Mac. Join the early-access list and we’ll send you the download as soon as it’s ready.",
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
	tagline: "Made for Mac.",
	links: [
		{ label: "Download", href: "/download" },
		{ label: "Privacy policy", href: "/privacy" },
		{ label: "GitHub", href: GITHUB_URL },
	],
	columns: [
		{
			title: "Features",
			links: [
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
			a: "OpenDot is a Mac app that gives you a team of AI assistants called Dots. Each Dot has one job, a personality, and only the access you give it. They run in the background, watch your email, calendar and files, and tell you when something needs you.",
		},
		{
			q: "Is OpenDot free?",
			a: "Yes. OpenDot is free. If you connect a cloud model such as Claude or GPT with your own API key, that provider bills you directly. Run a local model through Ollama or LM Studio and it costs nothing.",
		},
		{
			q: "Which Macs does it run on?",
			a: "OpenDot needs macOS 14 or later and runs on both Apple silicon and Intel Macs. It is a Mac-only app for now.",
		},
		{
			q: "Does my data leave my Mac?",
			a: "Not by default. Everything lives in ~/.opendot on your Mac, in plain files you can read. Emails, phone numbers and card details are masked before anything reaches a cloud model, your keys are stored in the macOS Keychain, and any action that changes something, like sending, deleting or paying, asks you first.",
		},
		{
			q: "Which AI models can I use, and does it work offline?",
			a: "Claude, GPT, Gemini, Grok, Mistral, DeepSeek, OpenRouter and Groq, or local models through Ollama, LM Studio, llama.cpp and vLLM. Any compatible URL works too, and you can pick a different model for each Dot. With a local model a Dot's thinking never leaves your Mac, though Dots that read Gmail, Outlook or other online services still need a connection to reach them.",
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
			q: "Can Dots talk to each other safely?",
			a: "Yes, with Dot Links. You decide which Dots can message which, with role-based access, schedules, rate limits and approvals. For example, your Travel Dot can ask your Calendar Dot only on weekdays, five times an hour, and only if you approve. Every message is logged.",
		},
		{
			q: "When can I download OpenDot, and how does early access work?",
			a: "OpenDot is in early access and is not yet available to download. Join the early-access list with your email and we will send you the download as soon as it is ready. We will only email you about OpenDot.",
		},
	],
};

export const meta = {
	title: "OpenDot: your AI team, living on your Mac",
	description: hero.lead,
};
