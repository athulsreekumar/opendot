import type { Dot, DotId } from "@shared/types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../app/router";
import { cn } from "../../design-system/cn";
import { Avatar, IconButton, TextArea } from "../../design-system/components";
import { IconSend, IconStop } from "../../design-system/icons";
import { useChat } from "../../stores/chat";
import { useDots } from "../../stores/dots";
import { useSettings } from "../../stores/settings";
import { useUi } from "../../stores/ui";
import { ClearChatDialog } from "./ChatHeader";

const MAX_CHARS = 100_000;

const COMMANDS = [
	{ name: "/clear", hint: "Clear this chat" },
	{ name: "/model", hint: "Change the model" },
	{ name: "/persona", hint: "Edit personality" },
	{ name: "/links", hint: "Open Dot Links" },
] as const;

const BUSY = new Set(["thinking", "typing", "tool", "talking-to", "handling-events", "waiting-approval"]);

export function MentionPicker({ dots, index, onPick }: { dots: Dot[]; index: number; onPick: (d: Dot) => void }) {
	if (dots.length === 0) return null;
	return (
		<div
			role="listbox"
			aria-label="Mention a Dot"
			className="absolute bottom-full left-0 z-popover mb-2 w-64 rounded-lg bg-elevated p-1 shadow-md"
		>
			{dots.map((d, i) => (
				<button
					key={d.id}
					type="button"
					role="option"
					aria-selected={i === index}
					onMouseDown={(e) => {
						e.preventDefault();
						onPick(d);
					}}
					className={cn(
						"flex h-9 w-full items-center gap-2 rounded-sm px-2 text-sm text-fg",
						i === index && "bg-hover",
					)}
				>
					<Avatar size="xs" color={d.appearance.color} emoji={d.appearance.emoji} name={d.name} />
					<span className="truncate">{d.name}</span>
				</button>
			))}
		</div>
	);
}

function CommandMenu({
	items,
	index,
	onPick,
}: {
	items: (typeof COMMANDS)[number][];
	index: number;
	onPick: (c: string) => void;
}) {
	if (items.length === 0) return null;
	return (
		<div
			role="listbox"
			aria-label="Commands"
			className="absolute bottom-full left-0 z-popover mb-2 w-64 rounded-lg bg-elevated p-1 shadow-md"
		>
			{items.map((c, i) => (
				<button
					key={c.name}
					type="button"
					role="option"
					aria-selected={i === index}
					onMouseDown={(e) => {
						e.preventDefault();
						onPick(c.name);
					}}
					className={cn(
						"flex h-8 w-full items-center justify-between rounded-sm px-2 text-sm",
						i === index && "bg-hover",
					)}
				>
					<span className="font-medium text-fg">{c.name}</span>
					<span className="text-xs text-fg-3">{c.hint}</span>
				</button>
			))}
		</div>
	);
}

export function Composer({ dotId }: { dotId: DotId }) {
	const dot = useDots((s) => s.byId(dotId));
	const text = useUi((s) => s.drafts[dotId] ?? "");
	const setDraft = useUi((s) => s.setDraft);
	const hasModels = useSettings((s) => s.models.length > 0);
	const hasDefault = useSettings((s) => !!s.settings?.defaultModel);
	const dots = useDots((s) => s.dots);
	const busyStatus = useDots((s) => BUSY.has(s.statuses[dotId]?.kind ?? "idle"));
	const anyStreaming = useChat((s) => {
		const c = s.byDot[dotId];
		if (!c) return false;
		for (let i = c.order.length - 1; i >= Math.max(0, c.order.length - 5); i--)
			if (c.byId[c.order[i]!]?.streaming) return true;
		return false;
	});
	const streaming = anyStreaming || busyStatus;
	const ref = useRef<HTMLTextAreaElement>(null);
	const caret = useRef(0);
	const [menuIndex, setMenuIndex] = useState(0);
	const [clearOpen, setClearOpen] = useState(false);
	const disabled = !hasModels && !hasDefault;
	const isSuper = dot?.kind === "super";

	// Let the auto-growing TextArea re-measure after programmatic draft changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: text drives the re-measure
	useLayoutEffect(() => {
		ref.current?.dispatchEvent(new Event("input"));
	}, [text]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refocus when switching Dots
	useEffect(() => {
		ref.current?.focus();
		const on = () => {
			ref.current?.focus();
			const el = ref.current;
			if (el) el.setSelectionRange(el.value.length, el.value.length);
		};
		window.addEventListener("od:focus-composer", on);
		return () => window.removeEventListener("od:focus-composer", on);
	}, [dotId]);

	const commandItems = useMemo(() => {
		if (!/^\/\w*$/.test(text)) return [];
		return COMMANDS.filter((c) => c.name.startsWith(text.toLowerCase()));
	}, [text]);

	const mention = useMemo(() => {
		if (!isSuper) return undefined;
		const before = text.slice(0, caret.current || text.length);
		const m = /(^|\s)@([^\s@]*)$/.exec(before);
		return m ? { query: m[2]!, start: before.length - m[2]!.length - 1 } : undefined;
	}, [isSuper, text]);
	const mentionDots = useMemo(
		() =>
			mention
				? dots
						.filter(
							(d) =>
								d.kind !== "super" &&
								!d.hiddenFromSuper &&
								d.name.toLowerCase().startsWith(mention.query.toLowerCase()),
						)
						.slice(0, 6)
				: [],
		[dots, mention],
	);

	const runCommand = (name: string) => {
		setDraft(dotId, "");
		switch (name) {
			case "/clear":
				setClearOpen(true);
				break;
			case "/model":
			case "/persona":
				useUi.getState().setDrawer(true);
				break;
			case "/links":
				navigate("#/links");
				break;
		}
	};

	const pickMention = (d: Dot) => {
		if (!mention) return;
		const before = text.slice(0, mention.start);
		const after = text.slice(caret.current || text.length);
		const next = `${before}@${d.name} ${after}`;
		setDraft(dotId, next);
		requestAnimationFrame(() => {
			const pos = before.length + d.name.length + 2;
			ref.current?.focus();
			ref.current?.setSelectionRange(pos, pos);
			caret.current = pos;
		});
	};

	const submit = (mode: "auto" | "steer" | "followUp") => {
		const t = text.trim();
		if (!t || disabled || t.length > MAX_CHARS) return;
		const cmd = COMMANDS.find((c) => c.name === t.toLowerCase());
		if (cmd) {
			runCommand(cmd.name);
			return;
		}
		setDraft(dotId, "");
		void useChat.getState().send(dotId, t, mode);
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.nativeEvent.isComposing) return;
		const menuOpen = commandItems.length > 0 || mentionDots.length > 0;
		const count = commandItems.length || mentionDots.length;
		if (menuOpen) {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				setMenuIndex((i) => (i + (e.key === "ArrowDown" ? 1 : count - 1)) % count);
				return;
			}
			if (
				e.key === "Tab" ||
				(e.key === "Enter" && !e.shiftKey && (mentionDots.length > 0 || text !== commandItems[menuIndex]?.name))
			) {
				e.preventDefault();
				const i = Math.min(menuIndex, count - 1);
				if (mentionDots.length > 0) pickMention(mentionDots[i]!);
				else if (e.key === "Tab") setDraft(dotId, commandItems[i]!.name);
				else runCommand(commandItems[i]!.name);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				setDraft(dotId, text.replace(/\/\w*$/, "").replace(/@[^\s@]*$/, ""));
				return;
			}
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (streaming) submit(e.metaKey || e.ctrlKey ? "steer" : "followUp");
			else submit("auto");
			return;
		}
		if (e.key === "Escape" && streaming) {
			e.preventDefault();
			void useChat.getState().abort(dotId);
		}
	};

	const over = text.length > MAX_CHARS * 0.9;
	return (
		<div className="shrink-0 border-t border-border-subtle bg-sidebar px-4 py-2.5">
			<div className="relative mx-auto flex w-full max-w-[var(--od-chat-max-w)] items-end gap-2">
				{commandItems.length > 0 && <CommandMenu items={commandItems} index={menuIndex} onPick={runCommand} />}
				{mentionDots.length > 0 && <MentionPicker dots={mentionDots} index={menuIndex} onPick={pickMention} />}
				<div className="min-w-0 flex-1">
					<TextArea
						ref={ref}
						autoGrow
						maxRows={8}
						rows={1}
						value={text}
						disabled={disabled}
						maxLength={MAX_CHARS}
						aria-label={`Message ${dot?.name ?? ""}`}
						placeholder={disabled ? "Add a model to start chatting" : `Message ${dot?.name ?? ""}`}
						className="od-selectable rounded-2xl bg-elevated px-4 py-2.5"
						onChange={(e) => {
							caret.current = e.target.selectionStart ?? e.target.value.length;
							setMenuIndex(0);
							setDraft(dotId, e.target.value);
						}}
						onSelect={(e) => {
							caret.current = e.currentTarget.selectionStart ?? 0;
						}}
						onKeyDown={onKeyDown}
					/>
				</div>
				{streaming ? (
					<>
						{text.trim() && (
							<IconButton
								variant="accent"
								size="lg"
								label="Queue follow-up"
								icon={<IconSend size={18} />}
								onClick={() => submit("followUp")}
							/>
						)}
						<IconButton
							variant="secondary"
							size="lg"
							label="Stop"
							icon={<IconStop size={16} />}
							onClick={() => void useChat.getState().abort(dotId)}
						/>
					</>
				) : (
					<IconButton
						variant="accent"
						size="lg"
						label="Send"
						icon={<IconSend size={18} />}
						disabled={disabled || !text.trim()}
						onClick={() => submit("auto")}
					/>
				)}
			</div>
			<div className="mx-auto mt-1 flex max-w-[var(--od-chat-max-w)] justify-between text-2xs text-fg-3">
				<span>
					{disabled ? (
						<>
							Add a model in{" "}
							<button type="button" onClick={() => navigate("#/settings/models")} className="text-link hover:underline">
								Settings → Models
							</button>
						</>
					) : streaming ? (
						"Enter queues a follow-up · ⌘↵ interrupts and steers"
					) : null}
				</span>
				{over && (
					<span>
						{text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
					</span>
				)}
			</div>
			<ClearChatDialog dotId={dotId} open={clearOpen} onOpenChange={setClearOpen} />
		</div>
	);
}
