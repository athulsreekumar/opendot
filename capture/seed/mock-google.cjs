// Capture-only: preloaded into the Electron main process (NODE_OPTIONS=--require) so the app's real Gmail / Calendar /
// Drive tools return believable, fictional data without any network or real Google account.
// Everything here is made up: people are fictional, addresses are @example.com.
"use strict";
if (process.type && process.type !== "browser") return;
const realFetch = globalThis.fetch;
if (typeof realFetch !== "function") return;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");
const day = (offset, h, m) => {
	const d = new Date();
	d.setDate(d.getDate() + offset);
	d.setHours(h, m, 0, 0);
	return d;
};
const rfc = (d) => d.toUTCString();

const MAIL = {
	m_maya: {
		from: "Maya Chen <maya.chen@example.com>",
		to: "jordan.avery@example.com",
		subject: "Q4 planning: need your sign-off on the budget",
		date: day(0, 8, 12),
		body: "Hi,\n\nThe Northwind Labs board sync is tomorrow at 9:30. Before then I need your sign-off on the Q4 budget (v3, attached in the Drive folder). The only open item is the contractor line: 38k vs 45k.\n\nCan you reply by 6 pm today?\n\nThanks,\nMaya",
	},
	m_acme: {
		from: "Acme Cloud Billing <billing@example.com>",
		to: "jordan.avery@example.com",
		subject: "Invoice #2041 is 14 days overdue",
		date: day(0, 7, 40),
		body: "Hello,\n\nInvoice #2041 for $1,284.00 (Acme Cloud, Team plan) was due on the 21st and is now 14 days overdue. Please pay by the end of the week to avoid service interruption.\n\nAcme Cloud Billing",
	},
	m_leo: {
		from: "Leo Park <leo.park@example.com>",
		to: "jordan.avery@example.com",
		subject: "New onboarding flow, round 2 designs",
		date: day(-1, 17, 5),
		body: "Hey! Round 2 of the onboarding flow is in Figma. I simplified step 3 and moved the permissions ask to the end. Would love your eyes before Thursday's review.\n\nLeo",
	},
	m_sam: {
		from: "Sam Rivera <sam.rivera@example.com>",
		to: "jordan.avery@example.com",
		subject: "Following up: investor update",
		date: day(-1, 11, 20),
		body: "Hi,\n\nThanks for the last update. Could you send the October numbers (MRR, churn, runway) before our 16:00 call tomorrow?\n\nBest,\nSam",
	},
	m_news: {
		from: "Product Weekly <digest@example.com>",
		to: "jordan.avery@example.com",
		subject: "This week in product: 7 stories",
		date: day(0, 6, 0),
		body: "Your weekly digest.",
	},
};

const msgJson = (id, full) => {
	const m = MAIL[id];
	return {
		id,
		threadId: `t_${id}`,
		snippet: m.body.slice(0, 80),
		payload: {
			mimeType: "text/plain",
			headers: [
				{ name: "From", value: m.from },
				{ name: "To", value: m.to },
				{ name: "Subject", value: m.subject },
				{ name: "Date", value: rfc(m.date) },
			],
			...(full ? { body: { data: b64(m.body) } } : {}),
		},
	};
};

const EVENTS = () => [
	{ id: "ev1", summary: "Board sync (Northwind Labs)", start: { dateTime: day(1, 9, 30).toISOString() }, end: { dateTime: day(1, 10, 30).toISOString() }, attendees: [{ email: "maya.chen@example.com" }] },
	{ id: "ev2", summary: "Design review with Leo", start: { dateTime: day(1, 13, 0).toISOString() }, end: { dateTime: day(1, 13, 45).toISOString() }, attendees: [{ email: "leo.park@example.com" }] },
	{ id: "ev3", summary: "Investor call (Sam Rivera)", start: { dateTime: day(1, 16, 0).toISOString() }, end: { dateTime: day(1, 16, 30).toISOString() }, attendees: [{ email: "sam.rivera@example.com" }] },
];

const json = (obj, status = 200) =>
	new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async function patchedFetch(input, init) {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	let u;
	try {
		u = new URL(url);
	} catch {
		return realFetch(input, init);
	}
	const method = (init && init.method) || "GET";
	// A pretend Ollama on this Mac (model discovery for the Models settings screen).
	if (u.hostname === "localhost" && u.port === "11434") {
		return json({ models: [{ name: "llama3.2:3b" }, { name: "qwen2.5:14b" }, { name: "mistral-nemo:12b" }] });
	}
	if (u.hostname === "gmail.googleapis.com") {
		const p = u.pathname.replace("/gmail/v1/users/me", "");
		if (p === "/messages" && method === "GET") {
			// Watchers poll without a free-text query: stay quiet. Searches get the inbox fixtures.
			if (!u.searchParams.get("q")) return json({});
			const q = (u.searchParams.get("q") || "").toLowerCase();
			const ids = Object.keys(MAIL).filter((id) => {
				if (q.includes("maya")) return id === "m_maya";
				if (q.includes("acme") || q.includes("invoice")) return id === "m_acme";
				if (q.includes("from:sam")) return id === "m_sam";
				return id !== "m_news";
			});
			return json({ messages: ids.map((id) => ({ id })) });
		}
		const mm = /^\/messages\/([^/]+)$/.exec(p);
		if (mm && MAIL[mm[1]]) return json(msgJson(mm[1], u.searchParams.get("format") === "full"));
		if (p === "/drafts" && method === "POST") return json({ id: "r-48213", message: { id: "18c1" } });
		if (p === "/drafts/send") return json({ id: "18c9f2a41b7", threadId: "t_m_maya" });
		if (p === "/profile") return json({ emailAddress: "jordan.avery@example.com", historyId: "1" });
		return json({});
	}
	if (u.hostname === "www.googleapis.com" && u.pathname.startsWith("/calendar/v3")) {
		if (u.pathname.endsWith("/events") && method === "GET") {
			if (u.searchParams.get("updatedMin") || u.searchParams.get("syncToken")) return json({ items: [], nextSyncToken: "sync-1" });
			return json({ items: EVENTS(), nextSyncToken: "sync-1" });
		}
		if (u.pathname.endsWith("/events") && method === "POST") return json({ id: "ev_new", htmlLink: "https://calendar.example.com/ev_new" });
		return json({});
	}
	if (u.hostname === "www.googleapis.com" && u.pathname.startsWith("/drive/v3")) {
		if (u.pathname.endsWith("/files")) {
			return json({
				files: [
					{ id: "f1", name: "Q4 budget v3", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: day(0, 7, 55).toISOString() },
					{ id: "f2", name: "Board deck: Q3 results", mimeType: "application/vnd.google-apps.presentation", modifiedTime: day(-1, 18, 30).toISOString() },
				],
			});
		}
		return json({});
	}
	if (/googleapis\.com$/.test(u.hostname) || u.hostname === "oauth2.googleapis.com") return json({});
	return realFetch(input, init);
};
