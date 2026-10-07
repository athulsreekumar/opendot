import { useEffect, useState } from "react";

export type Route =
	| { name: "chats"; dotId?: string }
	| { name: "links" }
	| { name: "activity" }
	| { name: "approvals"; approvalId?: string }
	| { name: "connections"; connectionId?: string }
	| { name: "settings"; section: string }
	| { name: "onboarding" }
	| { name: "gallery" }
	| { name: "quick" };

export function parseHash(hash: string): Route {
	const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
	switch (parts[0]) {
		case "links":
			return { name: "links" };
		case "activity":
			return { name: "activity" };
		case "approvals":
			return { name: "approvals", approvalId: parts[1] };
		case "connections":
			return { name: "connections", connectionId: parts[1] };
		case "settings":
			return { name: "settings", section: parts[1] ?? "models" };
		case "onboarding":
			return { name: "onboarding" };
		case "gallery":
			return { name: "gallery" };
		case "quick":
			return { name: "quick" };
		default:
			return { name: "chats", dotId: parts[1] };
	}
}

export function navigate(hash: string): void {
	if (window.location.hash !== hash) window.location.hash = hash;
}

export function useRoute(): Route {
	const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
	useEffect(() => {
		const on = () => setRoute(parseHash(window.location.hash));
		window.addEventListener("hashchange", on);
		return () => window.removeEventListener("hashchange", on);
	}, []);
	return route;
}
