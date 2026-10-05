import { forwardRef, type TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";
import { cn } from "../cn";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	autoGrow?: boolean;
	minRows?: number;
	maxRows?: number;
	showCount?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
	({ className, autoGrow = false, minRows = 1, maxRows = 8, showCount = false, maxLength, value, ...props }, ref) => {
		const mergedRef = useRef<HTMLTextAreaElement>(null);

		// Use the provided ref or the internal ref
		const internalRef = ref || mergedRef;

		// biome-ignore lint/correctness/useExhaustiveDependencies: internalRef is derived from ref but not needed in deps (standard ref pattern)
		useLayoutEffect(() => {
			if (!autoGrow) return;

			const textarea =
				(typeof internalRef === "function" ? null : internalRef?.current) ||
				(typeof internalRef === "object" && internalRef.current);

			if (!textarea) return;

			const updateHeight = () => {
				// Reset height to measure
				textarea.style.height = "auto";
				const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
				const minHeight = lineHeight * minRows;
				const maxHeight = lineHeight * maxRows;

				const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
				const newHeight = Math.min(scrollHeight, maxHeight);

				textarea.style.height = `${newHeight}px`;
				textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
			};

			updateHeight();

			textarea.addEventListener("input", updateHeight);
			return () => textarea.removeEventListener("input", updateHeight);
		}, [autoGrow, minRows, maxRows]);

		const currentValue = value || "";
		const charCount = typeof currentValue === "string" ? currentValue.length : 0;

		return (
			<div className="w-full">
				<textarea
					ref={(el) => {
						if (typeof internalRef === "function") {
							internalRef(el);
						} else if (internalRef) {
							internalRef.current = el;
						}
						mergedRef.current = el;
					}}
					className={cn(
						"w-full rounded-md bg-sunken border border-border-subtle text-md text-fg placeholder:text-fg-3",
						"transition-colors hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent",
						"p-3 resize-none",
						className,
					)}
					maxLength={maxLength}
					value={value}
					{...props}
				/>
				{showCount && maxLength && (
					<div className="mt-1 text-2xs text-fg-3 text-right">
						{charCount} / {maxLength}
					</div>
				)}
			</div>
		);
	},
);

TextArea.displayName = "TextArea";
