"use client";

import { Button } from "@/components/ui/Button";
import { GitHubButton } from "@/components/ui/GitHubButton";
import { openEarlyAccess } from "@/lib/early-access-client";
import { FEATURES } from "@/lib/features";

/** The inner pages' main call to action: GitHub, or the early-access dialog when that feature is switched on. */
export function EarlyAccessButton({ children, size = "lg" }: { children?: string; size?: "md" | "lg" }) {
	if (!FEATURES.earlyAccess) return <GitHubButton size={size}>{children ?? "Get it on GitHub"}</GitHubButton>;
	return (
		<Button size={size} onClick={() => openEarlyAccess("section")}>
			{children ?? "Get early access"}
		</Button>
	);
}
