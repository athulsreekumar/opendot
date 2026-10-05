/** Tolerant reader for a JSON object that is still streaming in (spec 14 §3). Returns undefined while nothing parses. */
export function parsePartialJson(text: string): Record<string, unknown> | undefined {
	const start = text.indexOf("{");
	if (start < 0) return undefined;
	const s = text.slice(start);
	const closersFor = (src: string): { body: string; closers: string } => {
		const stack: string[] = [];
		let inStr = false;
		let esc = false;
		for (const ch of src) {
			if (inStr) {
				if (esc) esc = false;
				else if (ch === "\\") esc = true;
				else if (ch === '"') inStr = false;
				continue;
			}
			if (ch === '"') inStr = true;
			else if (ch === "{") stack.push("}");
			else if (ch === "[") stack.push("]");
			else if (ch === "}" || ch === "]") stack.pop();
		}
		let body = src;
		if (inStr) {
			if (esc) body = body.slice(0, -1);
			body += '"';
		}
		return { body, closers: stack.reverse().join("") };
	};
	const attempt = (src: string): Record<string, unknown> | undefined => {
		const { body, closers } = closersFor(src);
		let b = body.replace(/[\s,]+$/, "");
		if (/:\s*$/.test(b)) b += "null";
		try {
			const v: unknown = JSON.parse(b + closers);
			return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
		} catch {
			return undefined;
		}
	};
	const direct = attempt(s);
	if (direct) return direct;
	// A dangling key with no value yet: drop it and retry.
	const trimmed = s.replace(/,?\s*"(?:[^"\\]|\\.)*"?\s*:?\s*$/, "");
	return trimmed === s ? undefined : attempt(trimmed);
}
