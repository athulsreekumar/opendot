import type { ReactNode } from "react";
import { AboutMeSettings } from "./AboutMeSettings";
import { AboutSettings } from "./AboutSettings";
import { AdvancedSettings } from "./AdvancedSettings";
import { AuditLog } from "./AuditLog";
import { BackgroundSettings } from "./BackgroundSettings";
import { GeneralSettings } from "./GeneralSettings";
import { ModelsSettings } from "./ModelsSettings";
import { NotificationSettings } from "./NotificationSettings";
import { PrivacySettings } from "./PrivacySettings";

const SECTIONS: Record<string, { title: string; render: () => ReactNode }> = {
	models: { title: "Models", render: () => <ModelsSettings /> },
	general: { title: "General", render: () => <GeneralSettings /> },
	privacy: { title: "Privacy", render: () => <PrivacySettings /> },
	"about-me": { title: "About me", render: () => <AboutMeSettings /> },
	background: { title: "Background", render: () => <BackgroundSettings /> },
	notifications: { title: "Notifications", render: () => <NotificationSettings /> },
	audit: { title: "Audit log", render: () => <AuditLog /> },
	advanced: { title: "Advanced", render: () => <AdvancedSettings /> },
	about: { title: "About", render: () => <AboutSettings /> },
};

export function SettingsScreen({ section }: { section: string }) {
	const s = SECTIONS[section] ?? SECTIONS.models;
	if (!s) return null;
	return (
		<div className="h-full overflow-y-auto bg-app">
			<div className="mx-auto w-full max-w-[760px] p-8 flex flex-col gap-8">
				<h1 className="text-3xl font-semibold text-fg">{s.title}</h1>
				{s.render()}
			</div>
		</div>
	);
}
