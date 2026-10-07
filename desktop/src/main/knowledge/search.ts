// Incremental BM25 over chunks. Uses the SuperBot tokenizer; keeps an inverted index so a query only touches
// the chunks that contain its terms (the SuperBot ranker re-tokenizes every document per query).
import { tokenize } from "../superbot/bm25";

const K1 = 1.2;
const B = 0.75;

/** Tokens plus a light plural fold so "notes" finds "note". */
export function terms(s: string): string[] {
	return tokenize(s).map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

interface Doc {
	len: number;
	tf: Map<string, number>;
}

export class Bm25Index {
	private readonly docs = new Map<number, Doc>();
	private readonly postings = new Map<string, Map<number, number>>();
	private totalLen = 0;

	get size(): number {
		return this.docs.size;
	}

	add(id: number, text: string): void {
		this.remove(id);
		const tf = new Map<string, number>();
		let len = 0;
		for (const t of terms(text)) {
			tf.set(t, (tf.get(t) ?? 0) + 1);
			len++;
		}
		this.docs.set(id, { len, tf });
		this.totalLen += len;
		for (const [t, n] of tf) {
			let p = this.postings.get(t);
			if (!p) {
				p = new Map();
				this.postings.set(t, p);
			}
			p.set(id, n);
		}
	}

	remove(id: number): void {
		const d = this.docs.get(id);
		if (!d) return;
		this.docs.delete(id);
		this.totalLen -= d.len;
		for (const t of d.tf.keys()) {
			const p = this.postings.get(t);
			if (!p) continue;
			p.delete(id);
			if (p.size === 0) this.postings.delete(t);
		}
	}

	search(query: string, limit: number): Array<{ id: number; score: number }> {
		const q = [...new Set(terms(query))];
		const N = this.docs.size;
		if (!q.length || !N) return [];
		const avg = Math.max(1, this.totalLen / N);
		const scores = new Map<number, number>();
		for (const w of q) {
			const p = this.postings.get(w);
			if (!p) continue;
			const idf = Math.log(1 + (N - p.size + 0.5) / (p.size + 0.5));
			for (const [id, f] of p) {
				const len = this.docs.get(id)!.len;
				scores.set(id, (scores.get(id) ?? 0) + idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / avg))));
			}
		}
		return [...scores]
			.map(([id, score]) => ({ id, score }))
			.sort((a, b) => b.score - a.score || a.id - b.id)
			.slice(0, limit);
	}
}
