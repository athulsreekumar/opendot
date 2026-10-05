import type { DotColor } from "@shared/types";

export function applyTheme(mode: "light" | "dark" | "system"): () => void {
	const root = document.documentElement;

	const setTheme = (theme: "light" | "dark") => {
		root.setAttribute("data-theme", theme);
	};

	if (mode === "system") {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		// Set initial theme based on current system preference
		setTheme(mediaQuery.matches ? "dark" : "light");

		// Listen for changes in system preference
		const handleChange = (e: MediaQueryListEvent) => {
			setTheme(e.matches ? "dark" : "light");
		};

		mediaQuery.addEventListener("change", handleChange);

		// Return unsubscribe function
		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	} else {
		setTheme(mode);

		// Return no-op unsubscribe function
		return () => {};
	}
}

export function applyAccent(color: DotColor): void {
	const root = document.documentElement;

	if (color === "teal") {
		// Remove overrides for teal (the default brand color)
		root.style.removeProperty("--od-accent");
		root.style.removeProperty("--od-accent-hover");
		root.style.removeProperty("--od-accent-subtle");
	} else {
		// Set accent colors from dot palette
		root.style.setProperty("--od-accent", `var(--od-dot-${color})`);
		root.style.setProperty("--od-accent-hover", `var(--od-dot-${color})`);
		root.style.setProperty("--od-accent-subtle", `var(--od-dot-${color}-soft)`);
	}
}
