// The curated icon set for Dot avatars (spec 09 §3.1). Pure data and helpers: no React here.
// The renderer maps each key to a lucide component (design-system/dot-icon-map.ts); main and shared only handle keys.
// Dots used to carry `appearance.emoji`; the helpers below migrate old data and clean up model replies.

// [key, label, keywords]. Keywords are lowercase words used by the picker search and by name/tagline matching.
const DEFS = [
	["message", "Chat", "chat message talk conversation general assistant helper"],
	["sparkles", "Sparkles", "sparkles magic super lead ai new special star"],
	["mail", "Mail", "mail email inbox gmail outlook newsletter messages letters"],
	["inbox", "Inbox", "inbox triage queue incoming"],
	["send", "Send", "send outreach deliver dispatch post"],
	["calendar", "Calendar", "calendar schedule meeting meetings events agenda appointments"],
	["clock", "Clock", "clock time timer deadline reminder reminders hours"],
	["search", "Search", "search find lookup discover query"],
	["telescope", "Research", "research telescope explore investigate scout study analysis"],
	["microscope", "Microscope", "science lab microscope detail analyse review"],
	["book", "Book", "book books read reading library docs documentation learn"],
	["graduation", "Learning", "graduation learn learning study school course tutor teach education"],
	["newspaper", "News", "news newspaper press media articles feed rss headlines"],
	["pen", "Writing", "pen write writing writer draft edit blog copy author essay"],
	["notebook", "Notes", "notebook notes journal diary notetaking memo"],
	["wallet", "Wallet", "wallet money finance budget spending cash savings expenses payments"],
	["credit-card", "Card", "card credit payment payments billing invoice checkout"],
	["receipt", "Receipt", "receipt receipts invoice invoices bills expense accounting tax"],
	["landmark", "Bank", "bank banking landmark government institution"],
	["chart", "Chart", "chart charts data analytics statistics metrics report reports numbers bar graph"],
	["trending", "Trending", "trending growth stocks invest investing market trends revenue"],
	["target", "Target", "target goal goals focus okr objectives aim"],
	["plane", "Plane", "plane flight flights travel trip airline airport vacation holiday"],
	["map-pin", "Place", "place location map pin nearby places address"],
	["compass", "Compass", "compass plan planner planning product direction navigate roadmap"],
	["car", "Car", "car drive driving commute vehicle transport"],
	["truck", "Truck", "truck delivery shipping logistics orders freight supply"],
	["code", "Code", "code coding developer programming software dev"],
	["terminal", "Terminal", "terminal shell command line cli scripts"],
	["git", "Git branch", "git branch repo repository pull requests version merge"],
	["bug", "Bug", "bug bugs debug qa defects issues"],
	["wrench", "Wrench", "wrench tool tools fix repair engineering build forge maintenance"],
	["database", "Database", "database sql tables records storage warehouse"],
	["cloud", "Cloud", "cloud hosting infrastructure devops servers"],
	["monitor", "Monitor", "monitor computer desktop screen it helpdesk devices"],
	["plug", "Plug", "plug integration integrations connector connect api webhook"],
	["bot", "Bot", "bot robot automation automate agent"],
	["shield", "Shield", "shield security secure protect protection safety compliance"],
	["lock", "Lock", "lock private privacy password secrets vault"],
	["scale", "Scale", "scale legal law contract contracts court justice policy"],
	["users", "People", "users people team teams hr hiring recruiting staff community members"],
	["user", "Person", "user person profile account contact contacts me"],
	["handshake", "Handshake", "handshake deal deals partner partnership customers clients agreement"],
	["megaphone", "Megaphone", "megaphone marketing campaign campaigns announce promotion ads social"],
	["briefcase", "Briefcase", "briefcase business work sales job career office crm"],
	["building", "Building", "building company office organisation organization corporate enterprise"],
	["headphones", "Headphones", "headphones support customer service helpdesk tickets help call"],
	["phone", "Phone", "phone call calls telephone sms text"],
	["mic", "Microphone", "microphone mic voice audio podcast dictation record"],
	["file", "File", "file files document documents pdf paperwork text"],
	["folder", "Folder", "folder folders files drive organize archive archivist"],
	["folder-kanban", "Projects", "projects project kanban board admin tasks operations"],
	["list-checks", "Checklist", "checklist todo tasks to-do list checks done"],
	["clipboard", "Clipboard", "clipboard forms form survey checklist records"],
	["home", "Home", "home house family household property rent real estate"],
	["heart", "Heart", "heart love favourite favorite care friends wellbeing"],
	["heart-pulse", "Health", "health fitness medical doctor wellness pulse habits"],
	["leaf", "Leaf", "leaf plant garden nature eco green calm sage mindfulness"],
	["sprout", "Sprout", "sprout grow people culture onboarding seedling"],
	["dumbbell", "Dumbbell", "dumbbell gym workout exercise training sport"],
	["brain", "Brain", "brain think mind memory ideas knowledge reasoning"],
	["lightbulb", "Idea", "idea ideas lightbulb brainstorm inspiration creative insight"],
	["bell", "Bell", "bell notification notifications alert alerts watch watcher"],
	["globe", "Globe", "globe web website internet world browse translate online"],
	["languages", "Languages", "languages translate translation language multilingual"],
	["shopping-cart", "Cart", "shopping cart store shop ecommerce buy purchase groceries"],
	["shopping-bag", "Bag", "bag shopping retail products fashion"],
	["gift", "Gift", "gift gifts present birthday occasion"],
	["tag", "Tag", "tag tags price pricing deals label offers"],
	["utensils", "Food", "food restaurant cooking recipe recipes meal meals dinner dining"],
	["camera", "Camera", "camera photo photos photography picture pictures"],
	["film", "Film", "film movie movies video videos cinema tv"],
	["music", "Music", "music songs playlist audio band"],
	["palette", "Palette", "palette design designer art creative colour color ux ui brand"],
	["rocket", "Rocket", "rocket launch startup ship release fast"],
	["zap", "Zap", "zap energy power quick fast electric"],
	["star", "Star", "star favourite favorite rating reviews best"],
	["moon", "Moon", "moon night sleep evening dream"],
	["sun", "Sun", "sun morning day weather daily briefing"],
	["paw", "Paw", "paw pet pets dog cat animal vet"],
] as const;

export type DotIconKey = (typeof DEFS)[number][0];

export interface DotIconDef {
	key: DotIconKey;
	label: string;
	keywords: string[];
}

export const DOT_ICONS: readonly DotIconDef[] = DEFS.map(([key, label, kw]) => ({
	key,
	label,
	keywords: kw.split(" "),
}));

export const DOT_ICON_KEYS: readonly DotIconKey[] = DOT_ICONS.map((i) => i.key);

/** Neutral default: a plain chat bubble. */
export const DEFAULT_DOT_ICON: DotIconKey = "message";
/** The icon the SuperDot template uses (its avatar normally shows the brand mark instead). */
export const SUPER_DOT_ICON: DotIconKey = "sparkles";

const KEY_SET: ReadonlySet<string> = new Set(DOT_ICON_KEYS);

export function isDotIconKey(v: unknown): v is DotIconKey {
	return typeof v === "string" && KEY_SET.has(v);
}

// ───────────────────────── Emoji migration table ─────────────────────────

const EMOJI_TABLE: Record<string, DotIconKey> = {};
function addEmoji(key: DotIconKey, emojis: string) {
	for (const e of [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emojis)]) {
		const s = normalizeEmoji(e.segment);
		if (s.trim()) EMOJI_TABLE[s] = key;
	}
}

/** Drop variation selectors and surrounding whitespace so "🛠️" and "🛠" match. */
function normalizeEmoji(s: string): string {
	return s.replace(/[︎️‍]/g, "").trim();
}

addEmoji("mail", "📬📭📧✉💌📩📨📮");
addEmoji("inbox", "📥🗳");
addEmoji("send", "📤📡");
addEmoji("calendar", "📅🗓📆");
addEmoji("clock", "⏰⏱⏲🕐⏳⌛🕒");
addEmoji("search", "🔎🔍🕵");
addEmoji("telescope", "🔭🧐");
addEmoji("microscope", "🔬");
addEmoji("book", "📚📖📕📗📘📙🔖");
addEmoji("graduation", "🎓🏫");
addEmoji("newspaper", "📰🗞");
addEmoji("pen", "✍🖊🖋✏📝🖍");
addEmoji("notebook", "📓📔📒");
addEmoji("wallet", "💸💰💵💴💶💷🪙🤑👛");
addEmoji("credit-card", "💳");
addEmoji("receipt", "🧾");
addEmoji("landmark", "🏦🏛");
addEmoji("chart", "📊📉");
addEmoji("trending", "📈💹");
addEmoji("target", "🎯");
addEmoji("plane", "✈🛫🛬🛩🧳🏝");
addEmoji("compass", "🧭");
addEmoji("map-pin", "📍🗺📌");
addEmoji("car", "🚗🚕🚙🚘🚌🚆");
addEmoji("truck", "🚚📦🚛🚢");
addEmoji("code", "💻⌨");
addEmoji("git", "🔀");
addEmoji("bug", "🐛🐞");
addEmoji("wrench", "🛠🔧🔨⚙🧰");
addEmoji("database", "🗄💾");
addEmoji("cloud", "☁⛅");
addEmoji("monitor", "🖥");
addEmoji("plug", "🔌");
addEmoji("bot", "🤖🦾");
addEmoji("shield", "🛡🔐");
addEmoji("lock", "🔒🔑🗝");
addEmoji("scale", "⚖");
addEmoji("users", "👥👪🫂👫");
addEmoji("user", "👤🙂😀😊🧑");
addEmoji("handshake", "🤝");
addEmoji("megaphone", "📣📢");
addEmoji("briefcase", "💼👔");
addEmoji("building", "🏢🏭🏬");
addEmoji("headphones", "🎧💁🛎");
addEmoji("phone", "📞☎📱");
addEmoji("mic", "🎤🎙");
addEmoji("file", "📄📃📑");
addEmoji("folder", "🗂📁📂🗃");
addEmoji("list-checks", "✅☑✔");
addEmoji("clipboard", "📋");
addEmoji("home", "🏠🏡");
addEmoji("heart", "❤🧡💛💚💙💜🖤🤍💗💖");
addEmoji("heart-pulse", "🩺🏥💊🧘");
addEmoji("leaf", "🌿🍃🌲🌳");
addEmoji("sprout", "🌱🪴");
addEmoji("dumbbell", "💪🏋🏃");
addEmoji("brain", "🧠");
addEmoji("lightbulb", "💡");
addEmoji("bell", "🔔🚨");
addEmoji("globe", "🌐🌎🌏🌍");
addEmoji("languages", "🗣");
addEmoji("shopping-cart", "🛒");
addEmoji("shopping-bag", "🛍👜");
addEmoji("gift", "🎁🎂🎉");
addEmoji("tag", "🏷");
addEmoji("utensils", "🍽🍳🍕🍔🥗🍴");
addEmoji("camera", "📷📸📹");
addEmoji("film", "🎬🍿📺");
addEmoji("music", "🎵🎶🎼🎹🎸");
addEmoji("palette", "🎨🖌");
addEmoji("rocket", "🚀");
addEmoji("zap", "⚡");
addEmoji("star", "⭐🌟");
addEmoji("moon", "🌙🌛😴");
addEmoji("sun", "☀🌞🌅");
addEmoji("paw", "🐶🐱🐾🐕🐈🦊");
addEmoji("sparkles", "✨✦💫🪄🔮");
addEmoji("message", "💬🗨💭");
/** Map one emoji (any variation) to an icon key, or undefined when it is not in the table. */
export function iconFromEmoji(emoji: string | undefined | null): DotIconKey | undefined {
	if (!emoji) return undefined;
	const first = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji.trim())][0]?.segment;
	if (!first) return undefined;
	return EMOJI_TABLE[normalizeEmoji(first)] ?? EMOJI_TABLE[normalizeEmoji(emoji)];
}

// ───────────────────────── Keyword matching ─────────────────────────

const WORD_RE = /[\p{L}\p{N}]+/gu;

function words(text: string): string[] {
	return (text.toLowerCase().match(WORD_RE) ?? []).filter((w) => w.length > 1);
}

/** Pick the icon whose keywords best match some free text (a Dot's name and tagline). */
export function iconFromText(...texts: Array<string | undefined>): DotIconKey | undefined {
	const ws = words(texts.filter(Boolean).join(" "));
	if (ws.length === 0) return undefined;
	let best: DotIconKey | undefined;
	let bestScore = 0;
	for (const icon of DOT_ICONS) {
		let score = 0;
		for (const w of ws) {
			for (const kw of icon.keywords) {
				if (w === kw || w === `${kw}s` || `${w}s` === kw) {
					score += icon.keywords[0] === kw || icon.key === kw ? 3 : 2;
					break;
				}
				// "emails" ~ "email", "scheduling" ~ "schedule": loose prefix match on longer words
				if (w.length >= 5 && kw.length >= 5 && (w.startsWith(kw.slice(0, 5)) || kw.startsWith(w.slice(0, 5)))) {
					score += 1;
					break;
				}
			}
		}
		if (score > bestScore) {
			best = icon.key;
			bestScore = score;
		}
	}
	return best;
}

/**
 * Turn whatever a model (or an old file) gave us for an icon into a valid key:
 * an exact key, a key with spaces/underscores/capitals, an emoji, or a single keyword.
 */
export function normalizeIconKey(raw: unknown): DotIconKey | undefined {
	if (typeof raw !== "string") return undefined;
	const s = raw.trim();
	if (!s) return undefined;
	if (isDotIconKey(s)) return s;
	const slug = s
		.toLowerCase()
		.replace(/^lucide[:\-/ ]/, "")
		.replace(/[\s_]+/g, "-");
	if (isDotIconKey(slug)) return slug;
	const emoji = iconFromEmoji(s);
	if (emoji) return emoji;
	if (/^[a-z][a-z0-9-]*$/.test(slug)) {
		const hit = DOT_ICONS.find((i) => i.keywords.includes(slug));
		if (hit) return hit.key;
	}
	return undefined;
}

export interface IconSource {
	icon?: unknown;
	emoji?: unknown;
	name?: string;
	tagline?: string;
}

/**
 * The one resolution order used everywhere: a valid icon key, else the old emoji via the table,
 * else keywords from the name and tagline, else the neutral default.
 */
export function resolveDotIcon(src: IconSource): DotIconKey {
	return (
		normalizeIconKey(src.icon) ??
		(typeof src.emoji === "string" ? iconFromEmoji(src.emoji) : undefined) ??
		iconFromText(src.name, src.tagline) ??
		DEFAULT_DOT_ICON
	);
}

/** Picker search: all icons for an empty query, otherwise those whose key, label or a keyword starts with a query word. */
export function searchDotIcons(query: string): DotIconDef[] {
	const qs = words(query);
	if (qs.length === 0) return [...DOT_ICONS];
	return DOT_ICONS.filter((i) =>
		qs.every(
			(q) =>
				i.key.includes(q) || i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.startsWith(q) || k === q),
		),
	);
}

// ───────────────────────── Dot file migration ─────────────────────────

/**
 * Upgrade the raw `data` of a dot.json: `appearance.emoji` becomes `appearance.icon`.
 * Returns the same object when nothing needs to change. Persisted on the next save.
 */
export function migrateDotAppearance<T>(raw: T): T {
	if (!raw || typeof raw !== "object") return raw;
	const dot = raw as { appearance?: Record<string, unknown>; name?: string; tagline?: string; kind?: string };
	const ap = dot.appearance;
	if (!ap || typeof ap !== "object") return raw;
	if (isDotIconKey(ap.icon) && !("emoji" in ap)) return raw;
	const icon =
		normalizeIconKey(ap.icon) ??
		(typeof ap.emoji === "string" ? iconFromEmoji(ap.emoji) : undefined) ??
		(dot.kind === "super" ? SUPER_DOT_ICON : undefined) ??
		iconFromText(dot.name, dot.tagline) ??
		DEFAULT_DOT_ICON;
	const { emoji: _legacy, ...rest } = ap;
	return { ...(raw as object), appearance: { ...rest, icon } } as T;
}
