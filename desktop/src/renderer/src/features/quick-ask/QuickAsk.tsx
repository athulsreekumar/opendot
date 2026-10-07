// The quick-ask bar (route #/quick, shown in its own small window by the global hotkey). It reuses the normal chat
// path: the question is sent with chat.send and the answer is read back from the same chat store the main window uses.
import { activeMention, filterMentionTargets, insertMention, parseMention } from "@shared/quickask";
import type { Dot, DotId } from "@shared/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../design-system/cn";
import { Avatar, Button, Kbd, Spinner } from "../../design-system/components";
import { IconCheck, IconCopy, IconExternal, IconSparkles, IconStop } from "../../design-system/icons";
import { api } from "../../lib/api";
import { modKey } from "../../lib/platform";
import { useApprovals } from "../../stores/approvals";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useSettings } from "../../stores/settings";
import { StreamingMarkdown } from "../chats/StreamingMarkdown";
import { selectAnswer } from "./answer";
import { QuickApproval } from "./QuickApproval";
import "./quick-ask.css";

const BUSY = new Set(["thinking", "typing", "tool", "talking-to", "handling-events", "waiting-approval", "queued"]);

interface Ask {
	dotId: DotId;
	question: string;
	startedAt: number;
}

function DotAvatar({ dot, size = "xs" }: { dot: Dot; size?: "xs" | "sm" }) {
	return (
		<Avatar
			size={size}
			color={dot.appearance.color}
			emoji={dot.appearance.emoji}
			name={dot.name}
			mark={dot.kind === "super"}
		/>
	);
}

export function QuickAsk() {
	const dots = useDots((s) => s.dots);
	const statuses = useDots((s) => s.statuses);
	const pending = useApprovals((s) => s.pending);
	const hasModel = useSettings((s) => s.models.length > 0 || !!s.settings?.defaultModel);
	const [text, setText] = useState("");
	const [caret, setCaret] = useState(0);
	const [menuIndex, setMenuIndex] = useState(0);
	const [ask, setAsk] = useState<Ask | undefined>();
	const [copied, setCopied] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const rootRef = useRef<HTMLDivElement>(null);

	const superDot = useMemo(() => dots.find((d) => d.kind === "super"), [dots]);
	const targets = useMemo(() => dots.filter((d) => d.kind !== "super" && !d.archived), [dots]);
	const askDot = ask ? dots.find((d) => d.id === ask.dotId) : undefined;

	const chat = useChat((s) => (ask ? s.byDot[ask.dotId] : undefined));
	const answer = useMemo(() => {
		if (!ask || !chat) return undefined;
		const msgs = chat.order.map((id) => chat.byId[id]!).filter((m) => m && !m.hidden);
		return selectAnswer(msgs, ask.question);
	}, [ask, chat]);

	const statusKind = ask ? (statuses[ask.dotId]?.kind ?? "idle") : "idle";
	const status = ask ? statuses[ask.dotId] : undefined;
	const hasReply = !!answer && (answer.text.trim().length > 0 || !!answer.error);
	// Until the Dot has shown any sign of life (status, tokens) a fresh question counts as in progress.
	const active = !!answer?.streaming || BUSY.has(statusKind) || hasReply;
	const [seen, setSeen] = useState(false);
	useEffect(() => {
		if (!ask) setSeen(false);
		else if (active) setSeen(true);
	}, [ask, active]);
	const busy = !!ask && !answer?.sendError && (!!answer?.streaming || BUSY.has(statusKind) || !seen);

	// Approvals for this question: the target Dot's, and any a fan-out started after it was asked.
	const approvals = useMemo(
		() => (ask ? pending.filter((a) => a.dotId === ask.dotId || new Date(a.createdAt).getTime() >= ask.startedAt) : []),
		[pending, ask],
	);

	const mention = useMemo(() => activeMention(text, caret), [text, caret]);
	const mentionDots = useMemo(() => (mention ? filterMentionTargets(targets, mention.query) : []), [mention, targets]);

	const busyRef = useRef(busy);
	busyRef.current = busy;

	const focusInput = useCallback(() => {
		const el = inputRef.current;
		if (!el) return;
		el.focus();
		el.select();
		setCaret(el.value.length);
	}, []);

	// Main shows and hides this window. On open the previous text is selected, on hide a finished answer is cleared.
	useEffect(() => {
		focusInput();
		const offs = [
			api.on("quickask:shown", () => {
				if (!busyRef.current) setAsk(undefined);
				setCopied(false);
				// Wait a frame: the window may still be mapping when the event arrives.
				requestAnimationFrame(focusInput);
			}),
			api.on("quickask:hidden", () => {
				if (!busyRef.current) setAsk(undefined);
			}),
		];
		window.addEventListener("focus", focusInput);
		return () => {
			for (const off of offs) off?.();
			window.removeEventListener("focus", focusInput);
		};
	}, [focusInput]);

	// The window is exactly as tall as the content (main clamps it).
	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		let last = 0;
		const report = () => {
			const h = Math.ceil(el.getBoundingClientRect().height);
			if (h === last || h === 0) return;
			last = h;
			void api.quickAsk.resize(h).catch(() => undefined);
		};
		report();
		const ro = new ResizeObserver(report);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Tell main what the bar is showing: the answering Dot (no unread badge for it) and whether an approval pins it open.
	const pinned = approvals.length > 0;
	const reportedDot = ask?.dotId;
	useEffect(() => {
		void api.quickAsk.report({ dotId: reportedDot, pinned }).catch(() => undefined);
	}, [reportedDot, pinned]);

	const send = useCallback(
		(openAfter = false) => {
			const parsed = parseMention(text, targets);
			const target = parsed.target ?? superDot;
			if (!parsed.text || !target || busyRef.current) return;
			setSeen(false);
			setAsk({ dotId: target.id, question: parsed.text, startedAt: Date.now() });
			setCopied(false);
			const done = useChat.getState().send(target.id, parsed.text);
			if (openAfter) void done.then(() => api.quickAsk.openInApp(target.id));
		},
		[text, targets, superDot],
	);

	const openInApp = useCallback(() => {
		if (ask) void api.quickAsk.openInApp(ask.dotId);
		else send(true);
	}, [ask, send]);

	const stop = () => {
		if (ask) void useChat.getState().abort(ask.dotId);
	};

	const copy = () => {
		if (!answer?.text) return;
		void navigator.clipboard
			?.writeText(answer.text)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1500);
			})
			.catch(() => undefined);
	};

	// Escape hides from anywhere in the bar, Ctrl/Cmd+Enter opens the chat in the main window.
	useEffect(() => {
		const on = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				void api.quickAsk.hide();
			} else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				openInApp();
			}
		};
		window.addEventListener("keydown", on);
		return () => window.removeEventListener("keydown", on);
	}, [openInApp]);

	const pickMention = (d: Dot) => {
		if (!mention) return;
		const next = insertMention(text, mention, d.name, caret);
		setText(next.text);
		setCaret(next.caret);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.setSelectionRange(next.caret, next.caret);
		});
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.nativeEvent.isComposing) return;
		if (mentionDots.length > 0) {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				const n = mentionDots.length;
				setMenuIndex((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) return;
				e.preventDefault();
				pickMention(mentionDots[Math.min(menuIndex, mentionDots.length - 1)]!);
				return;
			}
		}
		if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	// While typing a name, the avatar on the left previews who will answer.
	const previewDot = useMemo(
		() => parseMention(text, targets).target ?? askDot ?? superDot,
		[text, targets, askDot, superDot],
	);

	const showPanel = !!ask && !!askDot;
	const statusLine =
		status?.kind === "talking-to"
			? `Asking ${dots.find((d) => d.id === status.peerDotId)?.name ?? "a Dot"}…`
			: status?.kind === "tool"
				? status.label
				: "Thinking…";
	const canSend = hasModel && !!text.trim() && !busy;

	return (
		<div ref={rootRef} className="flex w-full flex-col">
			<div
				className={cn(
					"od-quick-surface flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-elevated shadow-lg",
				)}
			>
				<div className="relative flex h-14 shrink-0 items-center">
					<div className="pointer-events-none absolute left-4 flex items-center">
						{previewDot ? (
							<DotAvatar dot={previewDot} />
						) : (
							<span className="text-fg-3">
								<IconSparkles size={20} />
							</span>
						)}
					</div>
					<input
						ref={inputRef}
						type="text"
						value={text}
						aria-label="Ask SuperDot, or @ a Dot"
						placeholder={hasModel ? "Ask SuperDot, or @ a Dot" : "Add a model in OpenDot Settings to start"}
						autoComplete="off"
						spellCheck={false}
						className="od-selectable h-full w-full bg-transparent pl-14 pr-4 text-xl text-fg outline-none focus-visible:outline-none placeholder:text-fg-3"
						onChange={(e) => {
							setText(e.target.value);
							setCaret(e.target.selectionStart ?? e.target.value.length);
							setMenuIndex(0);
						}}
						onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
						onKeyDown={onKeyDown}
					/>
					{canSend && (
						<div className="pr-4 text-xs text-fg-3">
							<Kbd>↵</Kbd>
						</div>
					)}
				</div>

				{mentionDots.length > 0 && (
					<div role="listbox" aria-label="Mention a Dot" className="border-t border-border-subtle p-1">
						{mentionDots.map((d, i) => (
							<button
								key={d.id}
								type="button"
								role="option"
								aria-selected={i === menuIndex}
								onMouseDown={(e) => {
									e.preventDefault();
									pickMention(d);
								}}
								className={cn(
									"flex h-9 w-full items-center gap-2 rounded-sm px-3 text-sm text-fg",
									i === menuIndex && "bg-hover",
								)}
							>
								<DotAvatar dot={d} />
								<span className="truncate">{d.name}</span>
								{d.tagline && <span className="truncate text-xs text-fg-3">{d.tagline}</span>}
							</button>
						))}
					</div>
				)}

				{showPanel && askDot && answer && (
					<div className="flex flex-col border-t border-border-subtle">
						{approvals.map((a) => (
							<QuickApproval key={a.id} approval={a} />
						))}
						<div className="flex max-h-[360px] min-h-0 gap-3 overflow-y-auto px-4 py-3" data-testid="quick-answer">
							<div className="shrink-0 pt-0.5">
								<DotAvatar dot={askDot} />
							</div>
							<div className="od-selectable min-w-0 flex-1 text-md text-fg">
								<div className="mb-0.5 text-xs font-medium text-fg-2">{askDot.name}</div>
								{answer.sendError ? (
									<p className="text-sm text-danger">Couldn't send: {answer.sendError}</p>
								) : hasReply ? (
									<>
										{answer.text && (
											<StreamingMarkdown text={answer.text} streaming={busy} messageId={answer.messageId} />
										)}
										{answer.error && <p className="text-sm text-danger">{answer.error}</p>}
									</>
								) : (
									<div className="flex items-center gap-2 text-sm text-fg-2" role="status">
										{busy && <Spinner size={16} />}
										{busy ? statusLine : "No answer came back. Open the chat to see what happened."}
									</div>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2 border-t border-border-subtle px-3 py-2">
							<Button
								size="sm"
								variant="secondary"
								leadingIcon={<IconExternal size={14} />}
								onClick={() => void api.quickAsk.openInApp(askDot.id)}
							>
								Open in OpenDot
								<Kbd className="ml-1">{modKey}↵</Kbd>
							</Button>
							<Button
								size="sm"
								variant="ghost"
								disabled={!answer.text}
								leadingIcon={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
								onClick={copy}
							>
								{copied ? "Copied" : "Copy"}
							</Button>
							{busy && hasReply && (
								<Button size="sm" variant="ghost" leadingIcon={<IconStop size={12} />} onClick={stop}>
									Stop
								</Button>
							)}
							<span className="ml-auto text-2xs text-fg-3">
								<Kbd>Esc</Kbd> to close
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
