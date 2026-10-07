import { navigate } from "@/app/router";
import { cn } from "@/design-system/cn";

export const SETTINGS_SECTIONS = [
	{ id: "models", label: "Models" },
	{ id: "general", label: "General" },
	{ id: "privacy", label: "Privacy" },
	{ id: "about-me", label: "About me" },
	{ id: "briefing", label: "Daily briefing" },
	{ id: "background", label: "Background" },
	{ id: "notifications", label: "Notifications" },
	{ id: "quick-ask", label: "Quick ask" },
	{ id: "audit", label: "Audit log" },
	{ id: "advanced", label: "Advanced" },
	{ id: "about", label: "About" },
] as const;

export function SettingsNav({ section }: { section: string }) {
	return (
		<nav aria-label="Settings sections" className="flex flex-col gap-0.5 p-2">
			<h1 className="px-3 pt-2 pb-2 text-xl font-semibold text-fg">Settings</h1>
			{SETTINGS_SECTIONS.map((s) => {
				const active = s.id === section;
				return (
					<button
						key={s.id}
						type="button"
						aria-current={active ? "page" : undefined}
						onClick={() => navigate(`#/settings/${s.id}`)}
						className={cn(
							"h-9 px-3 rounded-md text-left text-md transition-colors",
							active ? "bg-selected text-fg font-medium" : "text-fg-2 hover:bg-hover hover:text-fg",
						)}
					>
						{s.label}
					</button>
				);
			})}
		</nav>
	);
}
