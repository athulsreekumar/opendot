import * as React from "react";
import { cn } from "../cn";

export interface KbdProps extends React.ComponentPropsWithoutRef<"kbd"> {}

export const Kbd = React.forwardRef<HTMLElement, KbdProps>(({ className, children, ...props }, ref) => (
	<kbd
		ref={ref}
		className={cn(
			"px-2 h-[18px] rounded-xs text-2xs font-mono",
			"bg-sunken border border-border-subtle",
			"inline-flex items-center justify-center",
			"select-none",
			className,
		)}
		{...props}
	>
		{children}
	</kbd>
));

Kbd.displayName = "Kbd";
