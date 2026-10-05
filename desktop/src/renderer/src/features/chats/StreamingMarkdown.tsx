import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { CodeBlock, Markdown } from "./Markdown";
import "./markdown.css";

export interface Block {
	text: string;
	/** An unclosed code fence. */
	open: boolean;
}

/** Split at blank lines outside fenced code. An unclosed fence becomes the (open) tail block. */
export function splitBlocks(text: string): Block[] {
	const blocks: Block[] = [];
	let cur: string[] = [];
	let fence: { ch: string; len: number } | null = null;
	const flush = () => {
		if (cur.length) blocks.push({ text: cur.join("\n"), open: false });
		cur = [];
	};
	for (const line of text.split("\n")) {
		const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
		if (fence) {
			cur.push(line);
			if (m && m[1]![0] === fence.ch && m[1]!.length >= fence.len && line.trim() === m[1]) fence = null;
			continue;
		}
		if (m) {
			fence = { ch: m[1]![0]!, len: m[1]!.length };
			cur.push(line);
			continue;
		}
		if (line.trim() === "") flush();
		else cur.push(line);
	}
	if (fence && cur.length) {
		blocks.push({ text: cur.join("\n"), open: true });
	} else flush();
	return blocks;
}

const MemoBlock = memo(function MemoBlock({ text }: { text: string }) {
	return <Markdown text={text} />;
});

function OpenFence({ text }: { text: string }) {
	const lines = text.split("\n");
	const lang = lines[0]!
		.replace(/^\s*[`~]+/, "")
		.trim()
		.split(/\s+/)[0];
	return <CodeBlock lang={lang} code={lines.slice(1).join("\n")} />;
}

export function StreamingDot() {
	// Zero-height wrapper: appearing/disappearing never shifts layout.
	return (
		<div aria-hidden="true" className="relative h-0">
			<span className="od-stream-dot absolute left-0 top-1 block h-1.5 w-1.5 rounded-full bg-accent" />
		</div>
	);
}

export function StreamingMarkdown({
	text,
	streaming,
	messageId,
}: {
	text: string;
	streaming?: boolean;
	messageId?: string;
}) {
	const blocks = useMemo(() => splitBlocks(text), [text]);
	const reported = useRef(false);

	useLayoutEffect(() => {
		if (reported.current || !text) return;
		reported.current = true;
		if (messageId) {
			try {
				performance.mark(`od:first-paint:${messageId}`);
			} catch {
				// ignore
			}
			void window.opendotTest?.reportPaint(messageId, performance.now() + performance.timeOrigin);
		}
	}, [text, messageId]);

	return (
		<div className="min-w-0">
			{blocks.map((b, i) =>
				b.open ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional by design (spec 14 §4)
					<OpenFence key={i} text={b.text} />
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional by design (spec 14 §4)
					<MemoBlock key={i} text={b.text} />
				),
			)}
			{streaming && <StreamingDot />}
		</div>
	);
}
