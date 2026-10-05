import * as React from "react";
import { cn } from "../cn";

export interface SegmentedControlOption {
	value: string;
	label: string;
	icon?: React.ReactNode;
}

export interface SegmentedControlProps {
	value: string;
	onValueChange: (value: string) => void;
	options: SegmentedControlOption[];
	size?: "sm" | "md";
	"aria-label"?: string;
}

const sizeClasses = {
	sm: "h-7 text-xs",
	md: "h-8 text-sm",
};

export const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
	({ value, onValueChange, options, size = "md", "aria-label": ariaLabel, ...props }, ref) => {
		const currentIndex = options.findIndex((opt) => opt.value === value);

		const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
			if (e.key === "ArrowRight") {
				e.preventDefault();
				const nextIndex = (currentIndex + 1) % options.length;
				const nextOption = options[nextIndex];
				if (nextOption) {
					onValueChange(nextOption.value);
				}
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				const prevIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
				const prevOption = options[prevIndex];
				if (prevOption) {
					onValueChange(prevOption.value);
				}
			}
		};

		return (
			<div
				ref={ref}
				role="radiogroup"
				aria-label={ariaLabel}
				className={cn("inline-flex gap-0.5 p-0.5 bg-sunken rounded-lg", "focus-visible:outline-none")}
				onKeyDown={handleKeyDown}
				{...props}
			>
				{options.map((option) => (
					// biome-ignore lint/a11y/useSemanticElements: using button with role=radio for styled appearance
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={value === option.value}
						onClick={() => onValueChange(option.value)}
						className={cn(
							"flex items-center justify-center gap-1 px-3 rounded-md",
							"transition-all duration-200",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus-ring",
							sizeClasses[size],
							value === option.value ? "bg-elevated shadow-xs text-fg" : "text-fg-2 hover:text-fg",
						)}
					>
						{option.icon && <span className="flex items-center justify-center flex-shrink-0">{option.icon}</span>}
						{option.label}
					</button>
				))}
			</div>
		);
	},
);

SegmentedControl.displayName = "SegmentedControl";
