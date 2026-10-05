import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import * as React from "react";
import { cn } from "../cn";

export const ScrollArea = React.forwardRef<
	React.ElementRef<typeof ScrollAreaPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
	<ScrollAreaPrimitive.Root ref={ref} {...props} className="h-full overflow-hidden">
		<ScrollAreaPrimitive.Viewport className={cn("w-full h-full [&>div]:!block [&>div]:!min-w-0", className)}>
			{children}
		</ScrollAreaPrimitive.Viewport>
		<ScrollAreaPrimitive.Scrollbar orientation="vertical" className="w-1.5 bg-transparent">
			<ScrollAreaPrimitive.Thumb className="bg-border hover:bg-border-strong rounded-full transition-colors" />
		</ScrollAreaPrimitive.Scrollbar>
		<ScrollAreaPrimitive.Scrollbar orientation="horizontal" className="h-1.5 bg-transparent">
			<ScrollAreaPrimitive.Thumb className="bg-border hover:bg-border-strong rounded-full transition-colors" />
		</ScrollAreaPrimitive.Scrollbar>
		<ScrollAreaPrimitive.Corner className="bg-transparent" />
	</ScrollAreaPrimitive.Root>
));

ScrollArea.displayName = "ScrollArea";
