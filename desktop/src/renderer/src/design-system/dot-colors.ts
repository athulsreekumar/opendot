import type { DotColor } from "@shared/types";

export function dotColorVars(color: DotColor): React.CSSProperties {
	return {
		"--dot": `var(--od-dot-${color})`,
		"--dot-soft": `var(--od-dot-${color}-soft)`,
	} as React.CSSProperties;
}
