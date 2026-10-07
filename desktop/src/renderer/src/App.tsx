import { useEffect, useState } from "react";
import { AppShell } from "@/app/AppShell";
import { navigate, useRoute } from "@/app/router";
import { Spinner, Toaster, TooltipProvider } from "@/design-system/components";
import { applyAccent, applyTheme } from "@/design-system/theme";
import { Gallery } from "@/features/gallery/Gallery";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { api } from "@/lib/api";
import { bootstrapStores } from "@/stores/bootstrap";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";

export function App() {
	const route = useRoute();
	const settings = useSettings((s) => s.settings);
	const [ready, setReady] = useState(false);
	const [e2e, setE2e] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			await bootstrapStores();
			await useUi.getState().hydrate();
			try {
				const info = await api.app.info();
				if (!cancelled) setE2e(info.e2e);
			} catch {
				// ignore
			}
			if (!cancelled) setReady(true);
		})().catch(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const offs = [
			api.on("app:focus-dot", ({ dotId, scrollTo }) => {
				navigate(`#/chats/${dotId}`);
				// A briefing notification opens SuperDot's chat scrolled to the briefing card.
				if (scrollTo === "briefing")
					setTimeout(() => window.dispatchEvent(new CustomEvent("od:scroll-briefing", { detail: { dotId } })), 400);
			}),
			api.on("app:navigate", ({ hash }) => navigate(hash)),
		];
		const onFocus = () => useUi.getState().setFocused(true);
		const onBlur = () => useUi.getState().setFocused(false);
		useUi.getState().setFocused(document.hasFocus());
		window.addEventListener("focus", onFocus);
		window.addEventListener("blur", onBlur);
		return () => {
			for (const off of offs) off?.();
			window.removeEventListener("focus", onFocus);
			window.removeEventListener("blur", onBlur);
		};
	}, []);

	const theme = settings?.theme;
	useEffect(() => {
		if (!theme) return;
		return applyTheme(theme);
	}, [theme]);

	const accent = settings?.accent;
	useEffect(() => {
		if (accent) applyAccent(accent);
	}, [accent]);

	const needsOnboarding = ready && settings?.onboardingDone === false && route.name !== "onboarding";
	useEffect(() => {
		if (needsOnboarding) navigate("#/onboarding");
	}, [needsOnboarding]);

	let content: React.ReactNode;
	if (!ready) {
		content = (
			<div className="flex h-full w-full items-center justify-center bg-app">
				<Spinner size={24} />
			</div>
		);
	} else if (route.name === "gallery" && (import.meta.env.DEV || e2e)) {
		content = <Gallery />;
	} else if (route.name === "onboarding") {
		content = (
			<div className="h-full w-full bg-app">
				<Onboarding />
			</div>
		);
	} else {
		content = <AppShell route={route} />;
	}

	return (
		<TooltipProvider delayDuration={500}>
			{content}
			<Toaster />
		</TooltipProvider>
	);
}
