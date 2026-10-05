import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

export interface SliderProps {
	value: number;
	onValueChange: (value: number) => void;
	min: number;
	max: number;
	step?: number;
	leftLabel?: React.ReactNode;
	rightLabel?: React.ReactNode;
	"aria-label"?: string;
}

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
	({ value, onValueChange, min, max, step = 1, leftLabel, rightLabel, "aria-label": ariaLabel, ...props }, ref) => (
		<div className="flex flex-col gap-2">
			<SliderPrimitive.Root
				ref={ref}
				value={[value]}
				onValueChange={(vals) => onValueChange(vals[0] ?? value)}
				min={min}
				max={max}
				step={step ?? 1}
				className="relative flex items-center select-none touch-none w-full h-5"
				aria-label={ariaLabel}
				{...props}
			>
				<SliderPrimitive.Track className="relative h-1 bg-active rounded-full flex-1">
					<SliderPrimitive.Range className="absolute h-full bg-accent rounded-full" />
				</SliderPrimitive.Track>
				<SliderPrimitive.Thumb className="block w-4 h-4 bg-fg-inverse border-2 border-border rounded-full shadow-sm hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring" />
			</SliderPrimitive.Root>

			{(leftLabel || rightLabel) && (
				<div className="flex justify-between text-xs text-fg-3">
					{leftLabel && <span>{leftLabel}</span>}
					{rightLabel && <span>{rightLabel}</span>}
				</div>
			)}
		</div>
	),
);

Slider.displayName = "Slider";
