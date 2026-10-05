import type { DotColor } from "@shared/types";
import { type ReactNode, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { navigate } from "../../app/router";
import { cn } from "../../design-system/cn";
import { dotColorVars } from "../../design-system/dot-colors";
import { IconCheck, IconCopy } from "../../design-system/icons";
import { api } from "../../lib/api";
import { useDots } from "../../stores/dots";
import "./markdown.css";

/** Plain text of a React node tree (for the Copy button). */
export function textOf(node: ReactNode): string {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (typeof node === "object" && "props" in node)
		return textOf((node as { props: { children?: ReactNode } }).props.children);
	return "";
}

export function CitationChip({ name, dotId, color }: { name: string; dotId: string; color: DotColor }) {
	return (
		<button
			type="button"
			style={dotColorVars(color)}
			onClick={() => navigate(`#/chats/${dotId}`)}
			className="mx-0.5 inline-flex h-5 items-center rounded-full bg-[var(--dot-soft)] px-2 align-baseline text-2xs font-medium text-[var(--dot)] transition-colors hover:brightness-95"
		>
			{name}
		</button>
	);
}

export function CodeBlock({ lang, code, children }: { lang?: string; code: string; children?: ReactNode }) {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		void navigator.clipboard?.writeText(code).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	};
	return (
		<div className="my-1.5 overflow-hidden rounded-md bg-sunken">
			<div className="flex h-7 items-center justify-between border-b border-border-subtle px-2.5">
				<span className="text-2xs text-fg-3">{lang || "text"}</span>
				<button
					type="button"
					onClick={copy}
					className="flex items-center gap-1 rounded-sm text-2xs text-fg-2 transition-colors hover:text-fg"
				>
					{copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<pre className="od-selectable m-0 overflow-x-auto p-2.5 font-mono text-xs">
				<code className={cn("hljs", lang && `language-${lang}`)}>{children ?? code}</code>
			</pre>
		</div>
	);
}

interface HNode {
	type: string;
	value?: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: HNode[];
}

/** Tiny rehype transform: `[Name]` → <cite-chip name="Name"> when Name is a known Dot. */
function citationPlugin(names: string[]) {
	const lookup = new Set(names.map((n) => n.toLowerCase()));
	return () => (tree: HNode) => {
		if (lookup.size === 0) return;
		const walk = (node: HNode) => {
			if (!node.children || node.tagName === "code" || node.tagName === "pre" || node.tagName === "a") return;
			const out: HNode[] = [];
			for (const child of node.children) {
				if (child.type !== "text" || !child.value || !child.value.includes("[")) {
					walk(child);
					out.push(child);
					continue;
				}
				const re = /\[([^\]\n]{1,60})\]/g;
				let last = 0;
				let m: RegExpExecArray | null = re.exec(child.value);
				while (m) {
					if (lookup.has(m[1]!.toLowerCase())) {
						if (m.index > last) out.push({ type: "text", value: child.value.slice(last, m.index) });
						out.push({ type: "element", tagName: "cite-chip", properties: { name: m[1] }, children: [] });
						last = m.index + m[0].length;
					}
					m = re.exec(child.value);
				}
				if (last === 0) out.push(child);
				else if (last < child.value.length) out.push({ type: "text", value: child.value.slice(last) });
			}
			node.children = out;
		};
		walk(tree);
	};
}

const remarkPlugins = [remarkGfm];

export function Markdown({ text }: { text: string }) {
	const dots = useDots((s) => s.dots);
	const key = dots.map((d) => d.name).join("\u0000");
	// biome-ignore lint/correctness/useExhaustiveDependencies: key captures the names
	const rehypePlugins = useMemo(
		() => [
			[rehypeHighlight, { detect: false, ignoreMissing: true }] as never,
			citationPlugin(dots.map((d) => d.name)) as never,
		],
		[key],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: key captures the dots used for citations
	const components = useMemo(
		() =>
			({
				a: ({ href, children }) => (
					<a
						href={href}
						onClick={(e) => {
							e.preventDefault();
							if (href) void api.app.openExternal(href);
						}}
						className="text-link underline-offset-2 hover:underline"
					>
						{children}
					</a>
				),
				p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
				ul: ({ children }) => <ul className="my-1.5 list-disc pl-[18px]">{children}</ul>,
				ol: ({ children }) => <ol className="my-1.5 list-decimal pl-[18px]">{children}</ol>,
				h1: ({ children }) => <h3 className="mb-1 mt-2 text-lg font-semibold">{children}</h3>,
				h2: ({ children }) => <h3 className="mb-1 mt-2 text-lg font-semibold">{children}</h3>,
				h3: ({ children }) => <h4 className="mb-1 mt-2 text-md font-semibold">{children}</h4>,
				blockquote: ({ children }) => (
					<blockquote className="my-1.5 border-l-2 border-border pl-3 text-fg-2">{children}</blockquote>
				),
				table: ({ children }) => (
					<div className="my-1.5 overflow-x-auto">
						<table className="border-collapse text-sm">{children}</table>
					</div>
				),
				th: ({ children }) => (
					<th className="border border-border-subtle px-2 py-1 text-left font-semibold">{children}</th>
				),
				td: ({ children }) => <td className="border border-border-subtle px-2 py-1">{children}</td>,
				pre: ({ children }) => {
					const child = (Array.isArray(children) ? children[0] : children) as
						| { props?: { className?: string; children?: ReactNode } }
						| undefined;
					const cls = child?.props?.className ?? "";
					const lang = /language-([\w-]+)/.exec(cls)?.[1];
					const inner = child?.props?.children;
					return (
						<CodeBlock lang={lang} code={textOf(inner).replace(/\n$/, "")}>
							{inner}
						</CodeBlock>
					);
				},
				code: ({ className, children }) =>
					className ? (
						<code className={className}>{children}</code>
					) : (
						<code className="rounded-xs bg-sunken px-1 font-mono text-sm">{children}</code>
					),
				"cite-chip": (props: { name?: string }) => {
					const d = dots.find((x) => x.name.toLowerCase() === (props.name ?? "").toLowerCase());
					return d ? <CitationChip name={d.name} dotId={d.id} color={d.appearance.color} /> : `[${props.name}]`;
				},
			}) as Components,
		[key],
	);
	return (
		<div className="od-selectable break-words text-md">
			<ReactMarkdown skipHtml remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
				{text}
			</ReactMarkdown>
		</div>
	);
}
