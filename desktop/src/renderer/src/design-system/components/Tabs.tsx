import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List ref={ref} className={cn("flex border-b border-border-subtle", className)} {...props} />
));

TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			"px-3 py-2 text-sm font-medium text-fg-2",
			"relative",
			"data-[state=active]:text-fg",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
			"transition-colors",
			className,
		)}
		{...props}
	>
		{props.children}
		<div
			className={cn(
				"absolute bottom-0 left-0 right-0 h-0.5 bg-accent",
				"transition-all duration-200",
				"data-[state=inactive]:scale-x-0",
				"data-[state=active]:scale-x-100",
			)}
		/>
	</TabsPrimitive.Trigger>
));

TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn("py-4", className)} {...props} />);

TabsContent.displayName = "TabsContent";
