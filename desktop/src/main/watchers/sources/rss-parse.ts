// Small regex-based RSS 2.0 / Atom parser (spec 12 §4). Not a general XML parser.
export interface FeedItem {
	id: string;
	title: string;
	link: string;
	summary: string;
	published?: string;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

function clean(raw: string): string {
	// Unwrap CDATA first (its content is not entity-encoded), decode the rest, then strip tags.
	const parts: string[] = [];
	let last = 0;
	const re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
	for (let m = re.exec(raw); m; m = re.exec(raw)) {
		parts.push(decodeEntities(raw.slice(last, m.index)), m[1] ?? "");
		last = m.index + m[0].length;
	}
	parts.push(decodeEntities(raw.slice(last)));
	return parts
		.join("")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function tag(block: string, name: string): string | undefined {
	const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
	return m?.[1];
}

function atomLink(block: string): string | undefined {
	const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1] ?? "");
	const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0];
	const href = pick ? /href=["']([^"']*)["']/i.exec(pick) : null;
	return href?.[1] ? decodeEntities(href[1]) : undefined;
}

export function parseFeed(xml: string): FeedItem[] {
	const out: FeedItem[] = [];
	const blocks = [
		...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => ({ b: m[1] ?? "", atom: false })),
		...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((m) => ({ b: m[1] ?? "", atom: true })),
	];
	for (const { b, atom } of blocks) {
		const title = clean(tag(b, "title") ?? "");
		let link = "";
		if (atom) link = atomLink(b) ?? "";
		else {
			const t = tag(b, "link");
			link = t ? clean(t) : (atomLink(b) ?? "");
		}
		const summary = clean(
			tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? tag(b, "content:encoded") ?? "",
		);
		const idRaw = tag(b, "guid") ?? tag(b, "id");
		const id = (idRaw ? clean(idRaw) : "") || link || title;
		if (!id) continue;
		const pub = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
		const item: FeedItem = { id, title, link, summary };
		if (pub) item.published = clean(pub);
		out.push(item);
	}
	return out;
}
