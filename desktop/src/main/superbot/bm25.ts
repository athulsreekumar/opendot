// Tiny BM25-lite ranking for the SuperBot directory (spec 13 §2).
const STOP = new Set(
	"a an the and or of to in on for with my me i is are be it at by what who how when do does can you your this that".split(
		" ",
	),
);

export function tokenize(s: string): string[] {
	return s
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((t) => t.length > 1 && !STOP.has(t));
}

export function rank<T>(
	docs: Array<{ item: T; text: string }>,
	query: string,
	k1 = 1.2,
	b = 0.75,
): Array<{ item: T; score: number }> {
	const q = [...new Set(tokenize(query))];
	const toks = docs.map((d) => tokenize(d.text));
	const avg = toks.reduce((s, t) => s + t.length, 0) / Math.max(1, toks.length);
	const df = new Map<string, number>();
	for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
	const N = docs.length;
	return docs
		.map((d, i) => {
			const t = toks[i]!;
			let score = 0;
			for (const w of q) {
				const f = t.filter((x) => x === w).length;
				if (!f) continue;
				const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
				score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * t.length) / avg)));
			}
			return { item: d.item, score };
		})
		.sort((a, b2) => b2.score - a.score);
}
