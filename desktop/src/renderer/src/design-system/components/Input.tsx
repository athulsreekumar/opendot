import { forwardRef, type ReactNode } from "react";
import { cn } from "../cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	leading?: ReactNode;
	trailing?: ReactNode;
	invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, leading, trailing, invalid, ...props }, ref) => (
		<div className="relative inline-flex items-center w-full">
			{leading && <div className="absolute left-3 text-fg-3 pointer-events-none flex items-center">{leading}</div>}
			<input
				ref={ref}
				className={cn(
					"h-9 w-full rounded-md bg-sunken border border-border-subtle text-md text-fg placeholder:text-fg-3",
					"transition-colors hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent",
					leading && "pl-10",
					trailing && "pr-10",
					invalid && "border-danger ring-2 ring-danger",
					className,
				)}
				aria-invalid={invalid}
				{...props}
			/>
			{trailing && <div className="absolute right-3 pointer-events-auto flex items-center">{trailing}</div>}
		</div>
	),
);

Input.displayName = "Input";
