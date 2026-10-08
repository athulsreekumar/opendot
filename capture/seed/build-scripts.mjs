// Generates scripts/*.json: fake-model scripts in the app's format ({ name, steps: [{ content, stopReason? }] }).
// Run: node seed/build-scripts.mjs   (the generated JSON is committed so the capture needs no build step)
// All people and companies are fictional; emails use @example.com.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "scripts");
mkdirSync(out, { recursive: true });

const text = (t) => ({ content: [{ type: "text", text: t }] });
const tool = (id, name, args, lead) => ({
	content: [...(lead ? [{ type: "text", text: lead }] : []), { type: "toolCall", id, name, arguments: args }],
	stopReason: "toolUse",
});
// A reply chosen by which Dot is asking, so parallel fan-outs don't depend on who the app calls first.
const byDot = (map) => ({ byDot: map });
const save = (name, steps) => writeFileSync(join(out, `${name}.json`), `${JSON.stringify({ name, steps }, null, "\t")}\n`);

// ───────────── New Dot: identity generation (the app's "architect" call) ─────────────
save("create-inbox", [
	// Compact JSON with the visible fields first (name, icon, colour, tagline, role) keeps the stream short.
	text(
		JSON.stringify({
			name: "Inbox",
			icon: "inbox",
			color: "blue",
			tagline: "Reads everything, flags what needs you",
			role: "You are Inbox, the user's email chief of staff. You watch Gmail, ignore the noise and surface only what needs a human decision. You check Calendar for deadlines and draft replies, but never send without a yes.",
			roles: ["comms", "email"],
			tone: "direct",
			verbosity: 30,
			formality: 55,
			emojiUsage: 0,
			quirks: ["Ends triage with 'Top priority:'"],
			dos: ["Group mail by the action it needs", "Say when something can wait"],
			donts: ["Send without showing the draft", "Guess at facts"],
			greeting: "Hi, I'm Inbox. I read your Gmail, check Calendar for deadlines and only tap you when something needs you.",
			alwaysOn: true,
			standingInstructions: "Tell me about mail from real people that needs a reply, a decision or a payment. Stay quiet about newsletters.",
			suggestedWatchers: [{ type: "gmail", label: "Gmail inbox", config: { labelIds: ["INBOX"] } }],
		}),
	),
]);

// ───────────── Always on: background replies to events ─────────────
save("inbox-urgent", [
	text(
		"[URGENT] Maya Chen needs your sign-off on the Q4 budget (v3) by 18:00 today. The board sync is tomorrow at 09:30, and the only open item is the contractor line: 38k vs 45k. Want me to draft a reply?",
	),
]);
save("inbox-update", [
	text(
		"[UPDATE] Leo Park posted round 2 of the onboarding designs. He simplified step 3 and moved the permissions ask to the end. He'd like your eyes on it before Thursday's review.",
	),
]);
save("calendar-moved", [
	text("[UPDATE] The board sync moved from 10:00 to 09:30 tomorrow. Nothing else on your calendar clashes with it."),
]);

// ───────────── Calendar ─────────────
save("calendar-tomorrow", [
	tool("tc_cal_1", "calendar_list_events", { from: "2026-10-06T00:00:00Z", to: "2026-10-06T23:59:59Z" }),
	text(
		[
			"Tomorrow is **meeting-heavy but clean**: three meetings and no clashes.",
			"",
			"| Time | Event | With |",
			"|---|---|---|",
			"| 09:30–10:30 | Board sync | Maya Chen |",
			"| 13:00–13:45 | Design review | Leo Park |",
			"| 16:00–16:30 | Investor call | Sam Rivera |",
			"",
			"- Your only prep window is **before 09:30**.",
			"- 10:30–13:00 is wide open. I'd keep it as focus time.",
			"",
			"Want me to block 10:30–12:30 so nobody books it?",
		].join("\n"),
	),
]);

// ───────────── SuperDot: fan-out then a cited answer ─────────────
// Replies are consumed in the order the app starts the asks (Inbox, Calendar, Travel, Research).
const tomorrowReplies = byDot({
	Inbox: [
		"Two things before tomorrow:",
		"- Maya Chen needs your sign-off on the Q4 budget (v3) before the 09:30 board sync. Open question: contractors at 38k or 45k.",
		"- Sam Rivera wants the October numbers (MRR, churn, runway) before the 16:00 call.",
		"Acme Cloud's invoice #2041 ($1,284) is overdue, but it isn't tomorrow's problem.",
	].join("\n"),
	Calendar: [
		"Three meetings tomorrow, no clashes:",
		"- 09:30–10:30 Board sync (Maya Chen)",
		"- 13:00–13:45 Design review (Leo Park)",
		"- 16:00–16:30 Investor call (Sam Rivera)",
		"The hours before 09:30 are your only real prep window.",
	].join("\n"),
	Travel: [
		"Nothing to do tomorrow. The Lisbon trip is on Nov 12, and check-in opens 24 hours before departure.",
		"Your passport is valid until 2029, so no paperwork is needed.",
		"Next step: pick seats once check-in opens.",
	].join("\n"),
	Research: [
		"Brief on Sam Rivera (Cobalt Peak Capital):",
		"- Led two seed rounds in developer tools last quarter (example.com/cobalt-peak/portfolio).",
		"- Wrote recently that investors now want proof of usage-based revenue.",
		"- Likely to ask about churn and runway.",
	].join("\n"),
});
save("superbot-tomorrow", [
	tool("tc_ask_1", "ask_dots", {
		requests: [
			{ dot: "Inbox", question: "What needs a reply or a decision from me before tomorrow?" },
			{ dot: "Calendar", question: "What is on my calendar tomorrow, and are there clashes or gaps?" },
			{ dot: "Travel", question: "Is there any travel or travel admin I need to handle in the next 48 hours?" },
			{ dot: "Research", question: "Give me a three-line brief on Sam Rivera and Cobalt Peak Capital for tomorrow's investor call." },
		],
	}),
	tomorrowReplies,
	tomorrowReplies,
	tomorrowReplies,
	tomorrowReplies,
	text(
		[
			"Tomorrow is meeting-heavy, so tonight is for prep:",
			"",
			"1. **Reply to Maya before 09:30.** She needs your sign-off on budget v3. The only open item is the contractor line, 38k vs 45k [Inbox].",
			"2. **Send Sam the October numbers** (MRR, churn, runway) before the 16:00 investor call [Inbox]. Expect him to ask about churn and runway [Research].",
			"3. **Use the free morning.** The board sync starts at 09:30, then design review at 13:00 and the investor call at 16:00. Nothing clashes [Calendar].",
			"",
			"No travel tasks tomorrow. Lisbon check-in doesn't open until Nov 11 [Travel].",
		].join("\n"),
	),
]);

// ───────────── Research ─────────────
save("research-summary", [
	tool("tc_fetch_1", "mcp__fetch__fetch", { url: "https://example.com/reviews/standing-desks-under-600" }),
	text(
		[
			"**Verdict: buy the Ridgeway Pro at $549.** Dual motors, a 275 lb load rating and a 10-year frame warranty put it ahead of the other two.",
			"",
			"| Desk | Price | Motors | Max load | Warranty | Take |",
			"|---|---|---|---|---|---|",
			"| Ridgeway Pro | $549 | Dual | 275 lb | 10 yr | Best overall |",
			"| Alder Frame | $429 | Dual | 220 lb | 5 yr | Best value |",
			"| Northline Desk 2 | $599 | Single | 185 lb | 7 yr | Quietest |",
			"",
			"**What the sources agree on**",
			"- Dual-motor frames wobble less above 45 in (Deskbench, Home Office Lab).",
			"- The Alder Frame is the only desk under $450 that passed the 200 lb load test (Deskbench).",
			"- Northline is the quietest at 42 dB, but its single motor slows down near the load limit (Home Office Lab).",
			"",
			"**Confidence: medium.** Reviews are consistent, but prices moved twice in the last 30 days.",
		].join("\n"),
	),
]);

// ───────────── Money ─────────────
save("money-subscriptions", [
	text(
		[
			"You have **11 recurring charges**, **$386 a month** ($4,632 a year).",
			"",
			"| Service | Monthly | Next renewal | Found in |",
			"|---|---|---|---|",
			"| Acme Cloud (Team) | $107 | Nov 21 | Invoice #2041 |",
			"| Orbit CRM | $89 | Nov 3 | Gmail receipt |",
			"| Cadence Fitness | $49 | Nov 9 | Gmail receipt |",
			"| Pixelforge Design | $45 | Nov 14 | Gmail receipt |",
			"| Streamline Mail | $29 | Nov 2 | Gmail receipt |",
			"| Beam Video | $24 | Oct 11 | Gmail receipt |",
			"| 5 smaller charges | $43 | various | Workspace folder |",
			"",
			"**Worth a look**",
			"- Acme Cloud went from $89 to $107 in September (+20%).",
			"- Orbit CRM and Streamline Mail both include a contact-sync add-on, so you may be paying twice.",
			"- Beam Video renews in 6 days.",
			"",
			"Want me to list every receipt behind these numbers?",
		].join("\n"),
	),
]);

// ───────────── Approval: a destructive tool call needs a yes ─────────────
const MAYA_BODY =
	"Hi Maya,\n\nv3 is approved. Let's keep the contractor line at 38k; we can revisit it after the board sync if needed.\n\nSee you at 09:30.\n\nJordan";
save("approval-send-email", [
	tool(
		"tc_draft_1",
		"gmail_create_draft",
		{
			to: "maya.chen@example.com",
			subject: "Re: Q4 planning: need your sign-off on the budget",
			body: MAYA_BODY,
			threadId: "t_m_maya",
		},
		"Here's the reply I'll send to Maya:\n\n> Hi Maya, v3 is approved. Let's keep the contractor line at 38k; we can revisit it after the board sync if needed. See you at 09:30. Jordan\n\nSaving it as a draft first.",
	),
	tool("tc_send_1", "gmail_send_draft", {
		draftId: "r-48213",
		to: "maya.chen@example.com",
		subject: "Re: Q4 planning: need your sign-off on the budget",
	}),
	text("Sent. Maya has your approval on budget v3, with contractors staying at 38k, well before the 09:30 board sync."),
]);

// ───────────── Seed histories: earlier conversations so every Dot has previews ─────────────
// One script per turn; the user's side of each turn lives in histories.json.
save("history-inbox-1", [
	tool("tc_h_inbox_1", "gmail_search", { query: "is:unread newer_than:1d", max: 10 }),
	text(
		[
			"Two things need you today:",
			"",
			"1. **Maya Chen, Q4 planning.** She needs your sign-off on budget v3 before tomorrow's 09:30 board sync. Only open item: contractors, 38k vs 45k.",
			"2. **Acme Cloud, invoice #2041.** 14 days overdue, $1,284.00.",
			"",
			"Everything else (a product newsletter, two receipts) can wait.",
			"",
			"**Top priority:** reply to Maya.",
		].join("\n"),
	),
]);
save("history-inbox-2", [
	tool("tc_h_inbox_2", "gmail_search", { query: "from:leo", max: 5 }),
	text(
		"Leo Park sent round 2 of the onboarding designs yesterday. He simplified step 3 and moved the permissions ask to the end, and wants your eyes on it before Thursday's review. No reply needed yet. Want a reminder on Wednesday?",
	),
]);
save("history-inbox-3", [
	tool("tc_h_inbox_3", "message_dot", { to: "Calendar", message: "When is the user's next free 30-minute slot tomorrow?" }),
	text("Free from 10:30 to 13:00 tomorrow, right after the board sync."),
	text(
		"Calendar says you're free from **10:30 to 13:00** tomorrow, straight after the board sync. That's the best time to call Maya about the contractor line.",
	),
]);
save("history-calendar-1", [
	tool("tc_h_cal_1", "calendar_list_events", { from: "2026-10-05T00:00:00Z", to: "2026-10-09T23:59:59Z" }),
	text(
		[
			"This week is **busy but balanced**: 11 meetings, about 9 hours.",
			"",
			"- **Tuesday** is the heavy day: board sync, design review and the investor call.",
			"- **Wednesday** has two hours of free focus time from 10:30.",
			"- **Thursday** ends at 15:00, before your 17:30 cut-off.",
			"",
			"Nothing clashes.",
		].join("\n"),
	),
]);
save("history-calendar-2", [
	text(
		"Yes. **Wednesday 14:00–14:30** or **Thursday 10:00–10:30**. Both sit right next to focus time, so neither breaks up your flow. Want me to send Leo an invite for Wednesday?",
	),
]);
save("history-research-1", [
	text(
		[
			"**Short answer: start with SQLite, move to Postgres when you need more than one writer.**",
			"",
			"- SQLite handles tens of thousands of reads per second on one machine and needs no server (sqlite.org/whentouse.html).",
			"- Postgres wins once several services write at once, or you need row-level security and replicas.",
			"- Migrating later is routine. Keep your SQL portable and it takes about a day.",
			"",
			"**Confidence: high.** Both the docs and independent benchmarks agree.",
		].join("\n"),
	),
]);
save("history-money-1", [
	text(
		[
			"Last month you spent **$418 on software** across 9 receipts. The biggest three:",
			"",
			"| Service | Amount |",
			"|---|---|",
			"| Acme Cloud | $107 |",
			"| Orbit CRM | $89 |",
			"| Pixelforge Design | $45 |",
			"",
			"That is $31 less than the month before.",
		].join("\n"),
	),
]);
save("history-money-2", [
	text(
		"Two renewals are coming up in the next 14 days: **Streamline Mail** ($29 on Nov 2) and **Orbit CRM** ($89 on Nov 3). Neither has changed price. I'll flag anything that does.",
	),
]);
save("history-travel-1", [
	text(
		[
			"Here's Lisbon so far:",
			"",
			"- **Nov 12** LX 2089, depart 07:55, arrive 10:20 local",
			"- **Nov 12–15** Hotel Alfama Terrace, confirmed",
			"- **Nov 15** return, depart 18:40",
			"",
			"**Next step:** choose seats when check-in opens on Nov 11.",
			"",
			"Travel tip: the airport metro runs every 8 minutes and beats a taxi at rush hour.",
		].join("\n"),
	),
]);
save("history-travel-2", [
	text(
		"Yes. Your passport is valid until 2029, well past the six-month minimum, so you're set for Lisbon.\n\n**Next step:** nothing until check-in opens on Nov 11.",
	),
]);
save("history-codebuddy-1", [
	tool("tc_h_gh_1", "mcp__github__get_pull_request", { owner: "quillbyte", repo: "app", pullNumber: 482 }),
	text(
		[
			"**Verdict: nearly there.** PR #482 (\"Debounce workspace search\") is safe to ship after one fix.",
			"",
			"**Must change**",
			"- `useSearch.ts:41` clears the timer on every render, so the debounce never fires. Move it into `useEffect` cleanup.",
			"",
			"**Nice to have**",
			"- Add a test for the empty-query case.",
			"",
			"The rest reads cleanly. Nice work on the naming",
		].join("\n"),
	),
]);
const weekReplies = byDot({
	Calendar: "Eleven meetings, about 9 hours. Tuesday is the heavy day. Wednesday has two free hours from 10:30. Nothing clashes.",
	Inbox: "Two could block you: Maya Chen's budget sign-off (needed before Tuesday 09:30) and Sam Rivera's request for the October numbers.",
});
save("history-superbot-0", [
	tool("tc_h_ask_0", "ask_dots", {
		requests: [
			{ dot: "Calendar", question: "Summarise the user's week: load, clashes and free focus time." },
			{ dot: "Inbox", question: "Which unanswered emails could block the user this week?" },
		],
	}),
	weekReplies,
	weekReplies,
	text(
		[
			"Your week is **busy but manageable**.",
			"",
			"- **Load:** 11 meetings, about 9 hours. Tuesday is the heavy day, and nothing clashes [Calendar].",
			"- **Focus time:** Wednesday has two free hours from 10:30 [Calendar].",
			"- **Blockers:** Maya Chen's budget sign-off and Sam Rivera's October numbers are the only open requests [Inbox].",
			"",
			"If you answer those two today, the rest of the week is clear.",
		].join("\n"),
	),
]);
save("history-superbot-1", [
	tool("tc_h_ask_1", "ask_dots", {
		requests: [{ dot: "Inbox", question: "Has anyone replied about invoice #2041?" }],
	}),
	text("No reply yet. The last message from Acme Cloud is this morning's overdue notice."),
	text(
		"Not yet. The last word from Acme Cloud is this morning's overdue notice, and nobody has replied since [Inbox]. Want me to ask Inbox to draft a payment reminder for you to review?",
	),
]);


// ───────────── Organisation: "Add single sign-on for customers" (one script drives the whole project) ─────────────
// A "perDot" step answers every later call from a per-Dot queue, so parallel tasks do not depend on call order.
// delayMs keeps a task "in flight" long enough to photograph the board mid-project.
const deliver = (file, content, reply, delayMs) => ({ ...(delayMs ? { delayMs } : {}), deliver: { file, content, text: reply } });
const late = (delayMs, t) => ({ delayMs, ...text(t) });
save("org-sso", [
	{
		perDot: {
			SuperDot: [
				{
					delayMs: 2500,
					...tool("tc_org_plan", "propose_plan", {
						projectId: "$PROJECT_ID",
						note: "Engineering builds the login flow and Security reviews it. At the same time Security runs a threat review, Design sketches the sign-in screen, Legal reads the identity provider's contract and Support updates the onboarding docs. Marketing announces it once the flow has shipped and the docs are ready.",
						tasks: [
							{
								id: "t1",
								title: "Build the login flow",
								brief: "Add single sign-on to the customer login page with SAML and OIDC. Done means customers can sign in with their company account and the callback has a test.",
								assignee: "Engineering",
								dependsOn: [],
								reviewer: "Security",
							},
							{
								id: "t2",
								title: "Threat review",
								brief: "Review the sign-in design for threats: session handling, token lifetime and account takeover. Done means a short list of risks with a fix for each.",
								assignee: "Security",
								dependsOn: [],
							},
							{
								id: "t3",
								title: "Update the onboarding docs",
								brief: "Update the customer onboarding guide with the single sign-on setup steps. Done means one page a customer admin can follow alone.",
								assignee: "Support",
								dependsOn: [],
							},
							{
								id: "t4",
								title: "Vendor contract for the identity provider",
								brief: "Read the identity provider's contract and summarise the key terms. Done means a one-page summary that lists anything to negotiate.",
								assignee: "Legal",
								dependsOn: [],
								reviewer: "human",
							},
							{
								id: "t5",
								title: "Design the sign-in screen",
								brief: "Sketch the new sign-in screen with the company-account button. Done means a short description of the layout and the error states.",
								assignee: "Design",
								dependsOn: [],
							},
							{
								id: "t6",
								title: "Announce to customers",
								brief: "Write the announcement email and the changelog entry. Done means both are drafted and ready to send.",
								assignee: "Marketing",
								dependsOn: ["t1", "t3"],
							},
						],
					}),
				},
				text("The plan is ready for your review."),
				text(
					[
						"## Single sign-on for customers",
						"",
						"All six tasks are done. Customers can now sign in with their company account, and the rollout is ready to announce.",
						"",
						"**Delivered**",
						"- The login flow with SAML and OIDC, with a callback test, reviewed and approved by Security (Engineering).",
						"- A threat review: five risks, each with a fix, and none left open (Security).",
						"- The sign-in screen, with the company-account button and its error states (Design).",
						"- A one-page setup guide for Okta and Microsoft Entra ID (Support).",
						"- A summary of the identity provider's contract, approved by you (Legal).",
						"- The announcement email and the changelog entry, drafted for you to send (Marketing).",
						"",
						"**Needs you**",
						"- Send the announcement when you are ready. Nothing else is waiting.",
					].join("\n"),
				),
			],
			Engineering: [
				deliver(
					"login-flow.md",
					"# Single sign-on login flow\n\nSAML and OIDC sign-in on the customer login page.\n\n- New route /sso/start and /sso/callback\n- Sessions last 8 hours, tokens are never stored in the browser\n- Callback test covers a wrong audience and an expired assertion\n",
					"[DONE] The login flow is built and works with both SAML and OIDC. Customers type their company email and are sent to their own identity provider, then land back in the app signed in. The callback has a test for a wrong audience and an expired assertion. Details are in login-flow.md.",
					2500,
				),
			],
			Security: [
				deliver(
					"threat-review.md",
					"# Threat review: single sign-on\n\n1. Session fixation: rotate the session id after sign-in.\n2. Token lifetime: 8 hours, no refresh in the browser.\n3. Account takeover through a shared email: match on the verified domain.\n4. Replay of an old assertion: check the one-time id.\n5. Open redirect after sign-in: allow only our own paths.\n",
					"[DONE] I found five risks and wrote a fix for each in threat-review.md. The two that matter most are rotating the session after sign-in and matching accounts on the verified company domain. None of them blocks the launch.",
				),
				late(18000, "[APPROVE] The session is rotated after sign-in, the callback checks the audience and the test covers an expired assertion."),
			],
			Design: [
				deliver(
					"sign-in-screen.md",
					"# Sign-in screen\n\nOne field for the work email, one button labelled Continue with company account. Errors appear under the field in plain words.\n",
					"[DONE] The sign-in screen has one field for the work email and one button, Continue with company account. If the company is not set up yet, we say so in plain words under the field and link to the setup guide.",
				),
			],
			Support: [
				text(
					"[BLOCKED] Should the onboarding guide cover Okta only, or Microsoft Entra ID as well? Most customers who asked for single sign-on use one of the two, and a second set of steps adds about a page.",
				),
				deliver(
					"onboarding-sso-guide.md",
					"# Set up single sign-on\n\n1. Open Settings, then Security, and choose Single sign-on.\n2. Copy the sign-in URL and the certificate into Okta or Microsoft Entra ID.\n3. Paste your identity provider's metadata back and select Test.\n4. Turn on Require single sign-on for everyone.\n",
					"[DONE] The onboarding guide now has a setup page that covers both Okta and Microsoft Entra ID, with four steps each. I also added a short troubleshooting list for the two errors customers will hit first. The guide is in onboarding-sso-guide.md.",
				),
			],
			Legal: [
				deliver(
					"vendor-contract-summary.md",
					"# Identity provider contract: summary\n\n- Term: 3 years at $18,400 a year\n- Uptime commitment: 99.9 percent, with service credits\n- Renewal: automatic, 60 days notice to cancel\n- To negotiate: the data-processing addendum and the exit fee\n",
					"[DONE] I read the contract and summarised it in vendor-contract-summary.md. It is a three-year term at $18,400 a year with a 99.9 percent uptime commitment. Two things are worth negotiating before you sign: the data-processing addendum and the exit fee. This is a summary to help you decide and is not legal advice.",
					40000,
				),
			],
			Marketing: [
				deliver(
					"announcement.md",
					"# Single sign-on is here\n\nSubject: Sign in to Northwind Labs with your company account\n\nStarting today, your team can sign in with Okta or Microsoft Entra ID. Setup takes about ten minutes.\n",
					"[DONE] The announcement email and the changelog entry are drafted in announcement.md. The email is short, leads with the benefit for IT admins and links to the setup guide. It is ready for you to send.",
				),
			],
		},
	},
]);

console.log("scripts written to", out);
