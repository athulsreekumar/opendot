import { cn } from "../../design-system/cn";
import "./markdown.css";

/** Three dots, 6px, staggered by 160 ms (spec 09 §3). */
export function TypingDots({ className }: { className?: string }) {
	return (
		<span role="status" aria-label="Typing" className={cn("flex h-5 items-center gap-1", className)}>
			<span className="od-typing-dot h-1.5 w-1.5 rounded-full bg-fg-3" />
			<span className="od-typing-dot h-1.5 w-1.5 rounded-full bg-fg-3 [animation-delay:160ms]" />
			<span className="od-typing-dot h-1.5 w-1.5 rounded-full bg-fg-3 [animation-delay:320ms]" />
		</span>
	);
}

/** Same padding/radius as an incoming MessageBubble so the first delta morphs in place. */
export function TypingIndicator() {
	return (
		<div className="flex justify-start">
			<div className="rounded-bubble rounded-tl-[4px] bg-bubble-in px-2.5 pb-1.5 pt-2 shadow-bubble">
				<TypingDots />
				<div className="h-[14px]" />
			</div>
		</div>
	);
}
