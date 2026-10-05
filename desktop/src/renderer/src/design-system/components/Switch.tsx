import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef } from "react";
import { cn } from "../cn";

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
	label?: string;
	description?: string;
}

export const Switch = forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
	({ className, label, description, ...props }, ref) => (
		<div className="flex flex-col gap-2">
			{/* biome-ignore lint/a11y/noLabelWithoutControl: Radix UI switch is not a standard form control */}
			<label className="flex items-center gap-2 cursor-pointer">
				<SwitchPrimitive.Root
					ref={ref}
					className={cn(
						"inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full",
						"bg-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
						"data-[state=checked]:bg-accent",
						className,
					)}
					{...props}
				>
					<SwitchPrimitive.Thumb
						className={cn(
							"pointer-events-none block h-[14px] w-[14px] rounded-full bg-fg",
							"transition-transform",
							"data-[state=checked]:translate-x-[14px] data-[state=checked]:bg-accent-fg",
						)}
					/>
				</SwitchPrimitive.Root>
				{label && <span className="text-md font-medium text-fg">{label}</span>}
			</label>
			{description && <p className="text-sm text-fg-2">{description}</p>}
		</div>
	),
);

Switch.displayName = "Switch";
