import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef, type ReactNode } from "react";
import { cn } from "../cn";

export const TooltipProvider = ({
	children,
	...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
	<TooltipPrimitive.Provider {...props}>{children}</TooltipPrimitive.Provider>
);

export interface TooltipProps {
	content: ReactNode;
	kbd?: string;
	side?: "top" | "right" | "bottom" | "left";
	children: React.ReactElement;
}

export const Tooltip = forwardRef<HTMLButtonElement, TooltipProps>(({ content, kbd, side = "top", children }) => (
	<TooltipPrimitive.Root delayDuration={500}>
		<TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
		<TooltipPrimitive.Content
			side={side}
			className={cn(
				"z-tooltip rounded-sm bg-fg text-fg-inverse text-xs px-2 py-1 max-w-60",
				"shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<span>{content}</span>
				{kbd && <kbd className="text-2xs font-mono opacity-60 ml-2">{kbd}</kbd>}
			</div>
			<TooltipPrimitive.Arrow className="fill-fg" />
		</TooltipPrimitive.Content>
	</TooltipPrimitive.Root>
));

Tooltip.displayName = "Tooltip";
