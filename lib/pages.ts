// Content for the feature pages, guides and download page. Every claim is taken from README.md, desktop/README.md or
// lib/copy.ts. If something is not documented there, it does not belong here.

export type Shot = { name: string; alt: string; caption?: string };
export type Step = { title: string; body: string; code?: string };
export type Block = {
	h2: string;
	p?: string[];
	list?: string[];
	steps?: Step[];
	code?: string;
	shot?: Shot;
};
export type Faq = { q: string; a: string };

export type ContentPage = {
	kind: "feature" | "guide" | "download" | "hub";
	path: string;
	/** <title> without the " | OpenDot" suffix. Keep at 50 characters or fewer. */
	title: string;
	/** Meta description, 120 to 160 characters. */
	description: string;
	h1: string;
	lead: string;
	/** The query this page is meant to answer. Not rendered. */
	keyword: string;
	eyebrow: string;
	/** Screenshot used for the page image (OG, Article image, image sitemap). */
	image: Shot;
	blocks: Block[];
	faq?: Faq[];
	related: string[];
	published?: string;
	modified?: string;
};

const DATE = "2026-10-05";

export const FEATURE_PAGES: ContentPage[] = [
	{
		kind: "feature",
		path: "/features/superdot",
		title: "SuperDot: Ask Your AI Team One Question",
		description:
			"SuperDot asks the right AI assistants on your Mac at once and gives you one answer with sources. See how OpenDot's built-in assistant works.",
		h1: "Ask once. SuperDot asks every Dot.",
		lead: "SuperDot is the assistant that sits above your Dots. It knows which Dot knows what, asks them in parallel and hands you one answer with sources.",
		keyword: "AI agents for Mac",
		eyebrow: "SuperDot",
		image: {
			name: "superbot-answer",
			alt: "SuperDot's combined answer in OpenDot, assembled from every Dot, with sources.",
		},
		published: DATE,
		blocks: [
			{
				h2: "One assistant on top of your whole team",
				p: [
					"Most AI apps give you a single chat. OpenDot gives you a team of Dots, and each Dot does one job: your Inbox Dot reads Gmail, your Calendar Dot guards your time, your Research Dot reads the web. That is great for focus, but some questions cut across all of them.",
					'That is what SuperDot is for. You ask something broad, such as "What do I need to prepare for tomorrow?", and SuperDot works out which Dots hold the answer. It asks all of them at the same time, streams their replies live, then streams a single combined answer.',
				],
				shot: {
					name: "superbot-fanout",
					alt: "SuperDot fanning a question out to several Dots in OpenDot and streaming their answers live.",
					caption: "SuperDot fans your question out to the right Dots in parallel.",
				},
			},
			{
				h2: "How an answer is built",
				steps: [
					{
						title: "You ask in plain English",
						body: "Type the question into the SuperDot chat, the same way you would message a person.",
					},
					{
						title: "SuperDot picks the right Dots",
						body: "It knows which Dots know what, so a question about tomorrow reaches Inbox, Calendar and Travel rather than every Dot you own.",
					},
					{
						title: "The Dots answer in parallel",
						body: "Each Dot replies from its own session, using only the tools and access you gave it. Replies stream in from the first word, so nothing sits behind a spinner.",
					},
					{
						title: "You get one answer, with sources",
						body: "SuperDot streams a single reply with [Inbox]-style citations, so you can see which Dot said what.",
					},
				],
			},
			{
				h2: "Citations you can check",
				p: [
					"A combined answer is only useful if you can trust it. Every claim in SuperDot's reply is tagged with the Dot it came from, in the style of [Inbox] or [Calendar]. If the Calendar Dot says Wednesday at 14:00 works for a meeting, you can see that it was the Calendar Dot.",
				],
			},
			{
				h2: "Ask a single Dot directly",
				p: [
					"You do not have to go through SuperDot every time. Type @Inbox followed by your question to ask one Dot directly, or open that Dot's chat and talk to it like any other conversation. SuperDot is a shortcut for the broad questions, not a gate in front of your Dots.",
				],
			},
			{
				h2: "Your rules still apply",
				p: [
					"SuperDot does not give your Dots extra powers. Each Dot keeps its own persona, tools, memory and permissions, and tools that change things, like sending, deleting or paying, still ask for your approval first. Personal details such as emails, phone numbers and card numbers are masked before anything reaches a cloud model, and you can pick a local model through Ollama or LM Studio if you prefer that nothing leaves your Mac.",
				],
			},
			{
				h2: "What a good SuperDot question looks like",
				list: [
					"What do I need to prepare for tomorrow?",
					"Summarise my week.",
					"Is anything urgent in my inbox, and does it clash with my calendar?",
					"Which renewals are coming up, and have I had any emails about them?",
				],
				p: [
					"Anything that spans more than one source of information is a good fit. The more Dots you have, the more SuperDot can combine.",
				],
			},
		],
		faq: [
			{
				q: "What is SuperDot?",
				a: "SuperDot is the assistant that sits above your Dots in OpenDot. Ask it one question and it asks the right Dots at once, combines their answers and shows you the sources.",
			},
			{
				q: "Can I still talk to a single Dot?",
				a: "Yes. Open that Dot's chat, or type @ followed by its name, such as @Inbox, to ask one Dot directly.",
			},
			{
				q: "How do I know where an answer came from?",
				a: "SuperDot tags each part of its reply with the Dot that supplied it, in the style of [Inbox], so you can trace every claim back to its source.",
			},
			{
				q: "Does SuperDot need a cloud model?",
				a: "No. OpenDot works with Claude, GPT, Gemini and other cloud models, and with local models through Ollama, LM Studio, llama.cpp and vLLM. You choose which model each Dot uses.",
			},
		],
		related: ["/features/always-on", "/features/privacy", "/features/connections", "/download"],
	},
	{
		kind: "feature",
		path: "/features/privacy",
		title: "Private AI Assistant for Mac: Data Stays Home",
		description:
			"OpenDot is a private AI assistant for Mac. Your data lives in ~/.opendot, personal details are masked before cloud models, and risky actions ask first.",
		h1: "A private AI assistant that keeps your data on your Mac",
		lead: "OpenDot stores everything in plain files on your Mac, masks personal details before a cloud model sees them, and asks before it does anything that changes the world.",
		keyword: "private AI assistant",
		eyebrow: "Privacy",
		image: {
			name: "privacy",
			alt: "OpenDot's privacy settings, showing what gets masked before a cloud model sees a message.",
		},
		published: DATE,
		blocks: [
			{
				h2: "Your data lives in a folder you can open",
				p: [
					"Everything OpenDot knows is stored in ~/.opendot on your Mac, as plain files you can read. Settings, each Dot's identity and memory, chat transcripts and the audit log are ordinary JSON and JSONL files. There is no account to create and no OpenDot server that holds your conversations.",
					"Each Dot also gets its own workspace folder, and that is the only folder its file tools can touch, plus any folders you add yourself. Deleting a Dot moves its folder to ~/.opendot/trash/ rather than erasing it.",
				],
			},
			{
				h2: "Personal details are masked before a cloud model sees them",
				p: [
					'When a Dot uses a cloud model, OpenDot first replaces personal details with placeholders and restores them locally when the answer comes back. A message that says "Send the invoice to maya.chen@example.com" reaches the model as "Send the invoice to ⟦EMAIL_1⟧".',
					"In Settings, Privacy, you choose what gets masked. The options include email addresses, phone numbers, card numbers, bank accounts (IBAN), social security numbers, IP addresses, API keys and tokens, and passwords in links. Names and street addresses are available too, and there is an experimental name detector. You can also add your own terms, which are always masked.",
					'A "Try it" box in the same screen shows exactly what the model would see, so you can test the rules before you rely on them.',
				],
				shot: {
					name: "privacy",
					alt: "OpenDot privacy settings with a live preview: the original text, and what the model sees with email, phone and card replaced by placeholders.",
					caption: "Settings, Privacy: choose what to mask and preview the result.",
				},
			},
			{
				h2: "Local models keep thinking on your Mac",
				p: [
					"Masking applies to what is sent to cloud models. If you run a model on your Mac through Ollama, LM Studio, llama.cpp or vLLM, the Dot's thinking never leaves your machine at all. Dots that read Gmail, Outlook or other online services still need a connection to reach them, but that traffic goes straight from your Mac to the service.",
				],
			},
			{
				h2: "Anything risky asks first",
				p: [
					"Every tool a Dot can use is set to Allow, Ask or Block, per tool. When a Dot wants to do something that changes the world, like sending an email, deleting a file or paying for something, an approval card appears with three choices: Allow once, Always allow or Deny.",
					"Dot Links add a second layer. They are permission rules between Dots: which Dot may message which, on what schedule, how often and whether you approve each message. Every message between Dots is logged.",
				],
				shot: {
					name: "approval-card",
					alt: "An OpenDot approval card asking to allow, always allow or deny an action.",
					caption: "Actions that change something wait for your yes.",
				},
			},
			{
				h2: "Keys and tokens stay in the Keychain",
				p: [
					"API keys and OAuth tokens are encrypted with the macOS Keychain, or with Windows DPAPI on a PC. Google and Microsoft sign-in use your own OAuth client, so your mail and calendar never pass through anyone else's app. The audit log records what Dots did without storing message contents.",
				],
			},
			{
				h2: "Open source, so you can check",
				p: [
					"OpenDot is MIT licensed and the source is on GitHub. If you want to know exactly what leaves your Mac, you can read the code instead of taking our word for it.",
				],
			},
		],
		faq: [
			{
				q: "Does my data leave my Mac?",
				a: "Not by default. Everything lives in ~/.opendot on your Mac. With a cloud model, only what the model needs to answer is sent, and personal details are masked first. With a local model, the Dot's thinking never leaves your Mac.",
			},
			{
				q: "Where are my API keys stored?",
				a: "Encrypted by your operating system: the macOS Keychain on a Mac, DPAPI on Windows.",
			},
			{
				q: "Can a Dot send an email without asking me?",
				a: "Only if you allow it. Tools that change things, like sending, deleting or paying, ask for approval first, and you can set each tool to Allow, Ask or Block.",
			},
			{
				q: "Is OpenDot open source?",
				a: "Yes. OpenDot is MIT licensed and the source is on GitHub.",
			},
		],
		related: ["/features/any-model", "/features/connections", "/guides/local-ai-assistant-mac-ollama", "/privacy"],
	},
	{
		kind: "feature",
		path: "/features/always-on",
		title: "Always-On AI Agents That Run on Your Mac",
		description:
			"OpenDot's Dots work in the background and react to new email, calendar changes, files and webhooks. They only tap you when it matters.",
		h1: "AI assistants that keep working while you don't",
		lead: "Dots run quietly in the background. The moment an email lands, a meeting moves or a file changes, the right Dot already knows, and it only taps you when it matters.",
		keyword: "AI agents Mac app",
		eyebrow: "Always on",
		image: {
			name: "always-on-update",
			alt: "An OpenDot Dot flags an urgent email and posts a quiet update.",
		},
		published: DATE,
		blocks: [
			{
				h2: "Watchers turn events into work",
				p: [
					"A chatbot waits for you to type. A Dot does not. Each Dot can have watchers, small listeners that notice something happening and wake the right Dot, with its own session, persona, tools and memory.",
					"OpenDot ships watchers for Gmail, Outlook, calendars, Drive, OneDrive and Teams, folders on your Mac, web pages, RSS feeds, MCP resources, schedules and a local webhook. Anything that can send a request can trigger a Dot.",
				],
				shot: {
					name: "always-on-update",
					alt: "An Inbox Dot flagging an urgent email the moment it arrives, with a quieter update below.",
					caption: "An urgent email is flagged the moment it lands.",
				},
			},
			{
				h2: "Three kinds of reply: urgent, update, or quiet",
				p: [
					"A Dot that pinged you for everything would be useless. When something happens, the Dot decides how loud to be. It replies [URGENT] when you need to act now, [UPDATE] when you should know but need not act, or it stays quiet when nothing needs you.",
					"You also set budgets that keep every Dot in check, so a busy inbox cannot run away with your model usage.",
				],
			},
			{
				h2: "A few examples",
				list: [
					'Your Inbox Dot sees "Invoice overdue" arrive and flags it as urgent.',
					"Your Calendar Dot notices a board meeting moved to 9:30 and updates you.",
					"A Dot watching a Drive folder tells you a deck was edited by a colleague.",
					"A Research Dot checks a web page or RSS feed on a schedule and only speaks up when something changed.",
				],
			},
			{
				h2: 'What "always on" means, honestly',
				p: [
					"Dots run while OpenDot is open, including in the background with the window closed. They cannot run while your Mac is asleep or OpenDot is quit. When your Mac wakes, the watchers catch up on what they missed.",
					"Gmail, Outlook and Drive are checked every 30 seconds rather than pushed instantly, because push notifications would need a public webhook. For most inboxes that is fast enough to feel instant. You can choose during setup whether Dots keep running in the background, and change it later in Settings, Background.",
				],
			},
			{
				h2: "Still under your control",
				p: [
					"Background does not mean unsupervised. Each Dot only has the access you gave it, tools that change things ask for approval, and the audit log records what Dots did. Personal details are masked before they reach a cloud model, and you can run the Dot on a local model so the thinking stays on your Mac.",
				],
			},
			{
				h2: "Set it up in one sentence",
				p: [
					'You do not write rules or workflows. Create a Dot by describing its job, such as "Watch my inbox and tell me what actually needs me", choose what it may touch, such as Gmail, Calendar or a folder, and OpenDot connects the right watchers. From then on the Dot works in the background, and its replies appear in its own chat in the sidebar like messages from a colleague.',
				],
			},
		],
		faq: [
			{
				q: "Do Dots run when my Mac is asleep?",
				a: "No. Dots run while OpenDot is open, including in the background with the window closed. When your Mac wakes, watchers catch up on what they missed.",
			},
			{
				q: "How quickly does a Dot notice a new email?",
				a: "Gmail, Outlook and Drive are checked every 30 seconds. Folders, schedules and the local webhook react as the event happens.",
			},
			{
				q: "Will my Dots spam me?",
				a: "They are built not to. A Dot replies [URGENT], [UPDATE] or stays quiet, and the budgets you set keep every Dot in check.",
			},
			{
				q: "What can trigger a Dot?",
				a: "New email, calendar changes, file changes in Drive, OneDrive or a local folder, web pages, RSS feeds, MCP resources, schedules and webhooks.",
			},
		],
		related: ["/features/superdot", "/features/connections", "/guides/ai-email-assistant-gmail", "/download"],
	},
	{
		kind: "feature",
		path: "/features/any-model",
		title: "Use Any AI Model on Mac, Including Ollama",
		description:
			"OpenDot works with Claude, GPT, Gemini, Grok and more, or fully local models through Ollama, LM Studio, llama.cpp and vLLM. Pick a model per Dot.",
		h1: "Claude, GPT, Gemini or a model on your own Mac",
		lead: "OpenDot is not tied to one AI company. Use a cloud model, run one locally with Ollama or LM Studio, or point it at any compatible URL, and switch per Dot.",
		keyword: "Ollama Mac app",
		eyebrow: "Any model",
		image: {
			name: "settings-models",
			alt: "OpenDot's model settings with cloud providers, Ollama on this Mac and a custom provider.",
		},
		published: DATE,
		blocks: [
			{
				h2: "Bring the model you already use",
				p: [
					"OpenDot supports cloud models from Anthropic (Claude), OpenAI (GPT), Google (Gemini), xAI (Grok), Mistral and DeepSeek, plus aggregators such as OpenRouter and Groq. You paste your own API key, it is encrypted by your operating system, and the provider bills you directly. OpenDot itself is free.",
				],
				shot: {
					name: "settings-models",
					alt: "OpenDot's Models settings: a default model, cloud providers with masked keys, Ollama under On this Mac, and a custom gateway.",
					caption: "Settings, Models: cloud, on this Mac and custom providers side by side.",
				},
			},
			{
				h2: "Run a model on your Mac with Ollama or LM Studio",
				p: [
					"For a fully local assistant, run Ollama, LM Studio, llama.cpp or vLLM. OpenDot detects them automatically and lists their models under On this Mac. A Dot running on a local model does its thinking entirely on your machine, with no API key and no per-token cost.",
					"If you just want to try it, start Ollama with a model, for example ollama pull llama3.1, and open OpenDot. Our step-by-step guide to running a local AI assistant on your Mac with Ollama walks through the whole setup.",
				],
			},
			{
				h2: "Any compatible URL works too",
				p: [
					"Using a company gateway, a self-hosted server or another provider that speaks the OpenAI or Anthropic API format? Add it as a custom provider with its URL. The Test button checks that it responds, and Discover models lists what it offers.",
				],
			},
			{
				h2: "A different model for every Dot",
				p: [
					"You set a default model in Settings, Models, and any Dot can use a different one. A Dot that triages email can run on a small, fast local model, while your Research Dot uses a larger cloud model. Switching is a setting, not a migration.",
				],
			},
			{
				h2: "Privacy depends on where the model runs",
				p: [
					"With a cloud model, only what the model needs to answer is sent, and personal details such as emails, phone numbers and card numbers are masked first. With a local model, nothing about the Dot's thinking leaves your Mac. Read more on how OpenDot protects your data.",
				],
			},
			{
				h2: "Choosing between cloud and local",
				p: [
					"A cloud model is usually the most capable and needs nothing but a key. A local model costs nothing to run and keeps everything on your Mac, at the price of using your Mac's own horsepower. You do not have to choose once for the whole app: put the Dots that handle sensitive mail on a local model and the Dots that do heavy research on a cloud model.",
					"Because the model is a setting on each Dot, you can also change your mind later without recreating anything. Switch a Dot from one provider to another and its name, personality, memory and permissions stay exactly as they were.",
				],
			},
		],
		faq: [
			{
				q: "Does OpenDot work with Ollama?",
				a: "Yes. Start Ollama with a model, for example ollama pull llama3.1, and OpenDot finds it automatically. LM Studio, llama.cpp and vLLM are detected the same way.",
			},
			{
				q: "Do I need an API key?",
				a: "Only for cloud models. Paste a key from Anthropic, OpenAI, Google, xAI, OpenRouter and others, and that provider bills you directly. Local models need no key and cost nothing.",
			},
			{
				q: "Can different Dots use different models?",
				a: "Yes. Set a default in Settings, Models, then pick a different model for any individual Dot.",
			},
			{
				q: "Can I use my own server or gateway?",
				a: "Yes. Any OpenAI-compatible or Anthropic-compatible URL can be added as a custom provider.",
			},
		],
		related: ["/guides/local-ai-assistant-mac-ollama", "/features/privacy", "/features/superdot", "/download"],
	},
	{
		kind: "feature",
		path: "/features/connections",
		title: "Gmail, Calendar, Microsoft 365 and MCP Connections",
		description:
			"Connect your AI team to Gmail, Google Calendar, Drive, Microsoft 365, your Mac's Calendar, Notes and files, and unlimited MCP servers.",
		h1: "Connect your AI team to Gmail, Calendar, Microsoft 365 and any MCP server",
		lead: "A Dot is only as useful as what it can reach. OpenDot connects to Google Workspace, Microsoft 365, your Mac and unlimited MCP servers, and each Dot gets only the access you give it.",
		keyword: "MCP client Mac",
		eyebrow: "Connections",
		image: {
			name: "connections",
			alt: "OpenDot's Connections hub listing Google Workspace, Microsoft 365, This Mac and MCP servers.",
		},
		published: DATE,
		blocks: [
			{
				h2: "Everything in one hub",
				p: [
					"Connections is where you set up what Dots can reach. It lists Google Workspace, Microsoft 365, your Mac and every MCP server you add. Connect once, then decide per Dot which connections it may use.",
				],
				shot: {
					name: "connections",
					alt: "The OpenDot Connections hub with Google, Microsoft, Mac and MCP servers.",
					caption: "Connections: Google, Microsoft, your Mac and any MCP server.",
				},
			},
			{
				h2: "Google Workspace",
				p: [
					"Connect Gmail, Google Calendar and Drive. OpenDot uses your own Google OAuth client, so your data never passes through anyone else's app. The app walks you through it: create a Google Cloud project, enable the Gmail, Calendar and Drive APIs, create a Desktop app OAuth client, paste the client ID and secret into OpenDot and sign in.",
				],
			},
			{
				h2: "Microsoft 365",
				p: [
					"Connect Outlook mail and calendar, OneDrive and Teams. Like Google, it uses your own app registration in Microsoft Entra: you paste the Application (client) ID into OpenDot and sign in. Both work and personal Microsoft accounts are supported.",
				],
			},
			{
				h2: "Your Mac",
				p: [
					"A Dot can use files, the shell, Calendar, Reminders, Contacts, Notes, screenshots, the clipboard and notifications on your Mac. The Mac apps use AppleScript, and macOS asks for permission the first time. A Dot's file tools are limited to its own workspace folder plus any folders you add.",
				],
			},
			{
				h2: "MCP servers: unlimited tools",
				p: [
					"OpenDot is an MCP client. Add as many Model Context Protocol servers as you like, local or remote. The Catalog installs Filesystem, Memory, Fetch, Git, GitHub, Notion, Linear, Sentry and Context7 in one click. You can also add any local command or remote URL, or paste the mcpServers block from Claude Desktop, Cursor or VS Code to import it. Our guide to using MCP servers on your Mac covers each route.",
				],
				shot: {
					name: "dot-info",
					alt: "A Dot's tool list in OpenDot with GitHub and Filesystem enabled and each tool set to Allow, Ask or Block.",
					caption: "Dot info, Tools: each tool is Allow, Ask or Block.",
				},
			},
			{
				h2: "Webhooks, folders and the web",
				p: [
					"Beyond accounts and tools, Dots can listen for webhooks, watch folders and web pages, and follow RSS feeds, which is how a Dot reacts to things that happen outside your inbox.",
				],
			},
			{
				h2: "Access is per Dot, per tool",
				p: [
					"Connecting an account does not hand it to every Dot. In a Dot's info panel you switch each connection on or off for that Dot, and set each individual tool to Allow, Ask or Block. Your Travel Dot can see the calendar without being able to read your mail.",
				],
			},
			{
				h2: "Start small",
				p: [
					"You do not need to connect everything on day one. A good first setup is one account and one Dot: connect Google, create an Inbox Dot with access to Gmail only, and watch how it behaves. Add Calendar, a Microsoft account or an MCP server when you want a second Dot to do more. Our guide to setting up an AI email assistant for Gmail walks through the first step.",
				],
			},
		],
		faq: [
			{
				q: "Does OpenDot support MCP?",
				a: "Yes. OpenDot is an MCP client with unlimited local or remote servers, a one-click catalog and JSON import from Claude Desktop, Cursor or VS Code.",
			},
			{
				q: "Do I need my own Google or Microsoft app?",
				a: "Yes. OpenDot uses your own OAuth client or app registration, so your data never passes through anyone else's app. The app walks you through the steps.",
			},
			{
				q: "Can I limit what each Dot can do?",
				a: "Yes. Choose which connections each Dot may use, and set each tool to Allow, Ask or Block.",
			},
			{
				q: "Which Mac apps can Dots use?",
				a: "Calendar, Reminders, Contacts, Notes, files, the shell, screenshots, the clipboard and notifications. macOS asks for permission the first time.",
			},
		],
		related: [
			"/guides/mcp-servers-mac",
			"/guides/ai-email-assistant-gmail",
			"/features/always-on",
			"/features/privacy",
		],
	},
];

export const GUIDE_PAGES: ContentPage[] = [
	{
		kind: "guide",
		path: "/guides/local-ai-assistant-mac-ollama",
		title: "Run a Local AI Assistant on Mac with Ollama",
		description:
			"Step by step: run a private, local AI assistant on your Mac with Ollama and OpenDot. Pull a model, build the app, and keep your data at home.",
		h1: "How to run a private AI assistant on your Mac with Ollama",
		lead: "A step-by-step guide to a local AI assistant that never sends your conversations to the cloud. You need a Mac, Ollama and about ten minutes.",
		keyword: "local AI assistant Mac",
		eyebrow: "Guide",
		image: {
			name: "settings-models",
			alt: "OpenDot's model settings with Ollama listed under On this Mac.",
		},
		published: DATE,
		blocks: [
			{
				h2: "What you will end up with",
				p: [
					"By the end of this guide you will have OpenDot running on your Mac with a local model served by Ollama. Your Dots will think on your own machine, with no API key, no per-token cost and nothing sent to a cloud model.",
					"OpenDot is free and open source, and there is no signed installer yet. This guide builds it from source, which takes a few minutes and is the same route the developers use.",
				],
			},
			{
				h2: "What you need",
				list: [
					"A Mac running macOS 14 Sonoma or later, Apple silicon or Intel.",
					"Node.js 22.19 or later (from nodejs.org, or brew install node).",
					"Git, which comes with the Xcode Command Line Tools (xcode-select --install).",
					"Ollama, from ollama.com.",
				],
			},
			{
				h2: "Steps",
				steps: [
					{
						title: "Install Ollama and pull a model",
						body: "Install Ollama from ollama.com, then download a model. llama3.1 is a good first choice, and you can use any model Ollama offers.",
						code: "ollama pull llama3.1",
					},
					{
						title: "Get the OpenDot code",
						body: "Clone the repository and install the app's dependencies.",
						code: "git clone https://github.com/athulsreekumar/opendot.git\ncd opendot/desktop\nnpm ci",
					},
					{
						title: "Run OpenDot",
						body: "Start the app. A short setup opens the first time.",
						code: "npm run dev",
					},
					{
						title: "Pick Ollama as your model",
						body: "During setup, choose the free and private option. If Ollama is running with a model, OpenDot finds it automatically. You can check it later in Settings, Models, where Ollama appears under On this Mac. Press Test to confirm it responds and Discover models to list what you have pulled.",
					},
					{
						title: "Create your first Dot",
						body: 'Describe the job in one sentence, for example "Watch my inbox and tell me what actually needs me", tick the tools it may use and let OpenDot write its name and personality.',
					},
					{
						title: "Optional: choose a model per Dot",
						body: "The default model applies to every Dot, but you can give any Dot a different one, so a quick local model can handle routine jobs while a larger one handles research.",
					},
				],
			},
			{
				h2: "Turn it into a real Mac app",
				p: [
					"npm run dev is perfect for trying things out. When you want an app in your Applications folder, build a DMG for your chip:",
				],
				code: "npm run dist:mac:arm64   # Apple silicon\nnpm run dist:mac:x64     # Intel",
				shot: {
					name: "sidebar-full",
					alt: "OpenDot running on a Mac with the sidebar of Dots.",
					caption: "OpenDot with a team of Dots, running on a local model.",
				},
			},
			{
				h2: "The first-launch warning",
				p: [
					"OpenDot builds are not notarized by Apple yet, so macOS warns you the first time. Right-click OpenDot in Applications, choose Open, then Open again. Or run xattr -dr com.apple.quarantine /Applications/OpenDot.app once.",
				],
			},
			{
				h2: "What stays on your Mac, and what does not",
				p: [
					"With Ollama, the model runs on your machine and the Dot's thinking never leaves it. Your Dots' settings, memory and chats live in ~/.opendot as plain files. Two honest limits: Dots that read Gmail, Outlook or other online services still need an internet connection to reach them, and Dots only run while OpenDot is open and your Mac is awake.",
				],
			},
		],
		faq: [
			{
				q: "Can I use OpenDot completely offline?",
				a: "The model and your Dots' data stay on your Mac with Ollama. Dots that read online services such as Gmail still need a connection to reach them.",
			},
			{
				q: "Which Ollama models work?",
				a: "OpenDot lists the models you have pulled in Ollama, for example llama3.1. Use Discover models in Settings, Models, to refresh the list.",
			},
			{
				q: "Does it cost anything?",
				a: "OpenDot is free and open source. A local model through Ollama costs nothing, and cloud providers only bill you if you add their API key.",
			},
			{
				q: "Does it work with LM Studio too?",
				a: "Yes. OpenDot also detects LM Studio, llama.cpp and vLLM, and accepts any compatible URL.",
			},
		],
		related: ["/features/any-model", "/features/privacy", "/download", "/guides/mcp-servers-mac"],
	},
	{
		kind: "guide",
		path: "/guides/ai-email-assistant-gmail",
		title: "AI Email Assistant for Gmail on Mac",
		description:
			"Set up an Inbox Dot that watches Gmail, flags what is urgent and asks before sending anything. A private AI email assistant for your Mac.",
		h1: "How to set up an AI email assistant for Gmail on your Mac",
		lead: "An Inbox Dot reads your Gmail in the background, tells you what actually needs you and asks before it does anything. Here is how to set one up.",
		keyword: "AI email assistant Mac",
		eyebrow: "Guide",
		image: {
			name: "always-on-update",
			alt: "An Inbox Dot in OpenDot flagging an urgent email the moment it arrives.",
		},
		published: DATE,
		blocks: [
			{
				h2: "What an Inbox Dot does",
				p: [
					"An Inbox Dot is a single-purpose assistant for your email. It watches Gmail, notices new messages as they arrive and tells you which ones need you. When something is urgent, it replies [URGENT]. When you should know but need not act, it sends an [UPDATE]. When nothing needs you, it stays quiet.",
					"It runs in the background while OpenDot is open, and it only has the access you give it.",
				],
			},
			{
				h2: "Setup",
				steps: [
					{
						title: "Create the Dot from a sentence",
						body: 'In OpenDot, create a new Dot and describe its job. For example: "Watch my inbox and tell me what actually needs me." OpenDot writes its name, look and personality.',
					},
					{
						title: "Connect Google",
						body: "Open Connections and choose Google & Microsoft. OpenDot uses your own OAuth client, so your mail never passes through anyone else's app. In Google Cloud Console, create a project, enable the Gmail, Calendar and Drive APIs, set up the OAuth consent screen as External and add yourself as a test user, then create an OAuth client ID of type Desktop app. Paste the client ID and secret into OpenDot and sign in.",
					},
					{
						title: "Give the Dot Gmail, and nothing else",
						body: "Open the Dot's info panel, then Tools. Switch on Google Workspace for this Dot. Leave connections it does not need switched off.",
					},
					{
						title: "Set sending to Ask",
						body: "Each tool can be Allow, Ask or Block. Set anything that sends or deletes to Ask, and the Dot will show an approval card with Allow once, Always allow and Deny before it acts.",
					},
					{
						title: "Let the watcher run",
						body: "OpenDot checks Gmail every 30 seconds. New mail reaches your Inbox Dot, and it decides whether to flag it, summarise it or stay quiet.",
					},
				],
			},
			{
				h2: "What you will see",
				p: [
					"Your Inbox Dot appears in the sidebar with its own chat. Urgent mail shows up as soon as it is noticed, and you can ask the Dot questions in its chat, for example which invoices are overdue.",
					'For broader questions, ask SuperDot. "What do I need to prepare for tomorrow?" reaches your Inbox and Calendar Dots together and returns one answer with [Inbox] and [Calendar] citations.',
				],
				shot: {
					name: "superbot-answer",
					alt: "SuperDot's combined answer in OpenDot, citing the Inbox and Calendar Dots.",
					caption: "SuperDot combines your Inbox and Calendar Dots into one answer.",
				},
			},
			{
				h2: "Keeping your email private",
				p: [
					"Email contains personal details, so OpenDot masks email addresses, phone numbers, card numbers and other sensitive values before a message reaches a cloud model. If you would rather nothing left your Mac, run the Dot on a local model through Ollama or LM Studio. Gmail itself still needs a connection, but your Dot's thinking stays home.",
				],
			},
			{
				h2: "Limits to know about",
				list: [
					"Dots run while OpenDot is open. They cannot run while your Mac is asleep, and they catch up when it wakes.",
					"Gmail is checked every 30 seconds, not pushed instantly.",
					"Setting up your own Google OAuth client takes a few minutes, once.",
				],
			},
		],
		faq: [
			{
				q: "Will the Inbox Dot send emails on its own?",
				a: "Only if you allow it. Tools that send, delete or pay ask for your approval first, and you can set each tool to Allow, Ask or Block.",
			},
			{
				q: "How fast does it notice new email?",
				a: "OpenDot checks Gmail every 30 seconds while the app is open.",
			},
			{
				q: "Does my email go to a cloud model?",
				a: "Only if you pick a cloud model. Personal details are masked first. Choose a local model through Ollama to keep the Dot's thinking on your Mac.",
			},
			{
				q: "Does it work with Outlook?",
				a: "Yes. OpenDot also connects to Microsoft 365, including Outlook mail and calendar, with your own app registration.",
			},
		],
		related: ["/features/always-on", "/features/connections", "/features/superdot", "/download"],
	},
	{
		kind: "guide",
		path: "/guides/mcp-servers-mac",
		title: "Use MCP Servers on Your Mac with OpenDot",
		description:
			"Add MCP servers to OpenDot in three ways: the one-click catalog, a custom command or URL, or by importing your Claude Desktop or Cursor config.",
		h1: "How to use MCP servers on your Mac with OpenDot",
		lead: "OpenDot is an MCP client, so every Dot can use the same Model Context Protocol servers you already know. Here is how to add them and control what each Dot may do.",
		keyword: "MCP client Mac",
		eyebrow: "Guide",
		image: {
			name: "dot-info",
			alt: "A Dot's tools in OpenDot, with GitHub and Filesystem MCP tools set to Allow, Ask or Block.",
		},
		published: DATE,
		blocks: [
			{
				h2: "What MCP gives your Dots",
				p: [
					"The Model Context Protocol (MCP) is an open standard for connecting AI apps to tools and data. An MCP server might read your GitHub pull requests, search Notion, fetch web pages or look through a folder. OpenDot is an MCP client, so you can add as many servers as you like, local or remote, and give each Dot only the ones it needs.",
				],
			},
			{
				h2: "Three ways to add a server",
				p: ["Open Connections in OpenDot and pick whichever route fits."],
				steps: [
					{
						title: "The Catalog",
						body: "One click installs popular servers: Filesystem, Memory, Fetch, Git, GitHub, Notion, Linear, Sentry, Context7 and more.",
					},
					{
						title: "Add MCP server",
						body: "Add any local command or a remote URL. This is the route for a server that is not in the Catalog.",
					},
					{
						title: "Import JSON",
						body: "Paste the mcpServers block from your Claude Desktop, Cursor or VS Code config, and OpenDot imports the lot in one go.",
						code: '{\n  "mcpServers": {\n    "fetch": { "command": "uvx", "args": ["mcp-server-fetch"] }\n  }\n}',
					},
				],
			},
			{
				h2: "Give a Dot access, tool by tool",
				p: [
					"Adding a server does not hand it to every Dot. Open a Dot's info panel, then Tools, and switch on the servers that Dot may use. Expand a server to see its individual tools and set each one to Allow, Ask or Block.",
					"A code-review Dot, for instance, might have GitHub switched on with listing and reading set to Allow, commenting set to Ask, and merging set to Block.",
				],
				shot: {
					name: "dot-info",
					alt: "OpenDot's Dot info panel with the GitHub tool list: list and get set to Allow, create and comment set to Ask, merge set to Block.",
					caption: "Per-tool control: Allow, Ask or Block.",
				},
			},
			{
				h2: "Things to know",
				list: [
					"Local MCP servers that use npx or uvx need Node.js or uv installed on your Mac.",
					"Remote MCP servers that need OAuth ask you to sign in the first time a Dot uses them. Their tokens are stored by pi in ~/.opendot/pi/mcp-auth.json (mode 600) rather than the Keychain.",
					"MCP resources can also act as triggers, so a Dot can react when one changes.",
				],
			},
			{
				h2: "Privacy with MCP",
				p: [
					"Tool results that go to a cloud model are masked for personal details, and anything that changes the world can be set to ask first. If you use a local model, the Dot's thinking stays on your Mac. Remember that a remote MCP server is, by definition, someone else's service, so choose the ones you trust.",
				],
			},
			{
				h2: "A good first MCP setup",
				p: [
					"Start with one server and one Dot. Install Fetch from the Catalog, create a Research Dot, switch Fetch on for it in Dot info, then ask the Dot to read a web page and summarise it. Once that works, add GitHub or Notion for a second Dot and set anything that writes to Ask. Giving each Dot a small, specific set of tools makes it easier to trust, and easier to debug when something goes wrong.",
				],
			},
		],
		faq: [
			{
				q: "Does OpenDot support MCP servers?",
				a: "Yes. OpenDot is an MCP client. Add unlimited local or remote servers from the Catalog, by hand or by importing JSON.",
			},
			{
				q: "Can I import my Claude Desktop MCP config?",
				a: "Yes. Paste the mcpServers block from Claude Desktop, Cursor or VS Code into Connections, Import JSON.",
			},
			{
				q: "Can I stop a Dot from using a specific tool?",
				a: "Yes. In the Dot's info panel, set any tool to Allow, Ask or Block.",
			},
			{
				q: "Why does my MCP server need Node.js?",
				a: "Local servers launched with npx need Node.js, and those launched with uvx need uv, on your Mac.",
			},
		],
		related: ["/features/connections", "/features/privacy", "/guides/local-ai-assistant-mac-ollama", "/download"],
	},
];

export const DOWNLOAD_PAGE: ContentPage = {
	kind: "download",
	path: "/download",
	title: "Download OpenDot for Mac and Windows, Free",
	description:
		"OpenDot is free and open source for macOS 14+ and Windows 10 and 11. Get the code on GitHub and build the app in minutes, or grab a ready-made build.",
	h1: "Download OpenDot for Mac and Windows",
	lead: "OpenDot is free and MIT licensed, and the full source is on GitHub. Build it for your Mac or PC in a few minutes, or grab a ready-made build.",
	keyword: "OpenDot download",
	eyebrow: "Download",
	image: { name: "sidebar-full", alt: "OpenDot on a Mac: the sidebar with a team of Dots." },
	published: DATE,
	blocks: [
		{
			h2: "Requirements",
			list: [
				"macOS 14 Sonoma or later, on Apple silicon or Intel.",
				"Or Windows 10 or 11, x64. Git for Windows gives Dots a shell.",
				"A model: an API key from any cloud provider, or a local model through Ollama or LM Studio.",
				"To build from source: Node.js 22.19 or later and Git.",
			],
		},
		{
			h2: "Option 1: build it from source",
			steps: [
				{
					title: "Get the code",
					body: "Clone the repository and install dependencies.",
					code: "git clone https://github.com/athulsreekumar/opendot.git\ncd opendot/desktop\nnpm ci",
				},
				{ title: "Try it", body: "Run the app with hot reload.", code: "npm run dev" },
				{
					title: "Build the app",
					body: "On a Mac, make a DMG, open it and drag OpenDot to Applications. On Windows, make an installer and run it.",
					code: "npm run dist:mac:arm64   # Apple silicon (M1 and later)\nnpm run dist:mac:x64     # Intel Macs\nnpm run dist:win         # Windows 10/11, x64",
				},
			],
		},
		{
			h2: "Option 2: a ready-made build",
			p: [
				"Every change to the app on main builds DMGs for both chip types and a Windows installer in the Desktop app CI on GitHub. Open the latest green run and download the OpenDot-mac or OpenDot-windows artifact. Tagged versions are published on the GitHub Releases page.",
			],
		},
		{
			h2: "The first-launch warning",
			p: [
				"OpenDot builds are not notarized by Apple or code-signed for Windows yet. On Windows, SmartScreen may say “Windows protected your PC”: click More info, then Run anyway. On a Mac, right-click OpenDot in Applications, choose Open, then Open again. Or run this once:",
			],
			code: "xattr -dr com.apple.quarantine /Applications/OpenDot.app",
		},
		{
			h2: "Choose a model on first launch",
			p: [
				"OpenDot opens with a short setup where you pick a model. Paste an API key for the fastest start, or run Ollama with a model such as llama3.1 for a free, private setup. Not sure yet? OPENDOT_FAKE_PROVIDER=1 npm run dev gives you a scripted test model that needs no key, so you can look around.",
			],
		},
		{
			h2: "Is it safe?",
			p: [
				"The full source is on GitHub under the MIT license, so you can read exactly what the app does. Everything it stores lives in ~/.opendot on your computer, personal details are masked before cloud models see them, and keys are encrypted by your operating system.",
			],
		},
		{
			h2: "After you install",
			p: [
				"Once OpenDot is running, create your first Dot by describing its job in a sentence, then connect Google or Microsoft if you want it to reach your mail and calendar. Our guides cover running a local assistant with Ollama, setting up an AI email assistant for Gmail and adding MCP servers.",
			],
		},
	],
	faq: [
		{
			q: "Is OpenDot free?",
			a: "Yes. OpenDot is free and open source under the MIT license. If you connect a cloud model with your own API key, that provider bills you directly. Local models cost nothing.",
		},
		{
			q: "Is there a Windows or Linux version?",
			a: "Yes for Windows 10 and 11 (x64). Everything works except the Mac-only Calendar, Reminders, Contacts and Notes tools; use Google Workspace or Microsoft 365 for those. Linux is not packaged yet.",
		},
		{
			q: "Why does macOS or Windows warn me when I open it?",
			a: "OpenDot builds are not notarized by Apple or code-signed for Windows yet. On a Mac, right-click the app and choose Open once, or run the xattr command above. On Windows, click More info, then Run anyway.",
		},
		{
			q: "Which computers does it run on?",
			a: "macOS 14 or later on Apple silicon and Intel Macs, and Windows 10 or 11 on x64 PCs.",
		},
	],
	related: ["/guides/local-ai-assistant-mac-ollama", "/features/superdot", "/features/privacy", "/features/any-model"],
};

export const FEATURES_HUB: ContentPage = {
	kind: "hub",
	path: "/features",
	title: "OpenDot Features: Your AI Team for Mac",
	description:
		"Explore OpenDot: SuperDot, always-on Dots, private by default, any model including Ollama, and connections to Gmail, Microsoft 365 and MCP.",
	h1: "Everything your AI team can do",
	lead: "OpenDot gives you Dots, single-purpose AI assistants that work around the clock and keep your data on your Mac. Here is how each part works.",
	keyword: "AI assistants for Mac",
	eyebrow: "Features",
	image: { name: "sidebar-full", alt: "OpenDot on a Mac: the sidebar with a team of Dots." },
	blocks: [],
	related: FEATURE_PAGES.map((p) => p.path),
};

export const GUIDES_HUB: ContentPage = {
	kind: "hub",
	path: "/guides",
	title: "OpenDot Guides: Local AI, Gmail and MCP",
	description:
		"Step-by-step guides for running a local AI assistant with Ollama, setting up an AI email assistant for Gmail and using MCP servers on your Mac.",
	h1: "Guides for running AI on your Mac",
	lead: "Practical, step-by-step walkthroughs for getting the most out of OpenDot, from local models to Gmail and MCP.",
	keyword: "local AI assistant Mac",
	eyebrow: "Guides",
	image: { name: "settings-models", alt: "OpenDot's model settings." },
	blocks: [],
	related: GUIDE_PAGES.map((p) => p.path),
};

export const CONTENT_PAGES: ContentPage[] = [FEATURES_HUB, ...FEATURE_PAGES, GUIDES_HUB, ...GUIDE_PAGES, DOWNLOAD_PAGE];

export const pageByPath = (path: string) => CONTENT_PAGES.find((p) => p.path === path);
