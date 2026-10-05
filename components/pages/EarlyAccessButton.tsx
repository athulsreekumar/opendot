"use client";

import { Button } from "@/components/ui/Button";
import { openEarlyAccess } from "@/lib/early-access-client";

/** The only client code on the inner pages: opens the shared early-access dialog. */
export function EarlyAccessButton({
	children = "Get early access",
	...rest
}: {
	children?: string;
	size?: "md" | "lg";
}) {
	return (
		<Button {...rest} onClick={() => openEarlyAccess("section")}>
			{children}
		</Button>
	);
}
