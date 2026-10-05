import * as React from "react";
import { cn } from "../cn";

export interface SpinnerProps {
	size?: 16 | 20 | 24;
	className?: string;
}

const sizeConfig = {
	16: { size: 16, strokeWidth: 2 },
	20: { size: 20, strokeWidth: 2 },
	24: { size: 24, strokeWidth: 2 },
};

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(({ size = 20, className }, ref) => {
	const config = sizeConfig[size];

	return (
		<svg
			ref={ref}
			width={config.size}
			height={config.size}
			viewBox={`0 0 ${config.size} ${config.size}`}
			fill="none"
			stroke="currentColor"
			className={cn("animate-spin text-accent", className)}
			role="status"
			aria-label="Loading"
		>
			<circle
				cx={config.size / 2}
				cy={config.size / 2}
				r={config.size / 2 - config.strokeWidth}
				strokeWidth={config.strokeWidth}
				stroke="currentColor"
				opacity={0.2}
			/>
			<path
				d={`M ${config.size / 2} ${config.strokeWidth} A ${config.size / 2 - config.strokeWidth} ${config.size / 2 - config.strokeWidth} 0 0 1 ${config.size - config.strokeWidth} ${config.size / 2}`}
				strokeWidth={config.strokeWidth}
				strokeLinecap="round"
			/>
		</svg>
	);
});

Spinner.displayName = "Spinner";
