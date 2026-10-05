import type { DotId } from "@shared/types";
import { useDots } from "@/stores/dots";
import { AlwaysOnSection } from "./AlwaysOnSection";
import { DangerZone } from "./DangerZone";
import { IdentitySection } from "./IdentitySection";
import { LinksSection } from "./LinksSection";
import { MemorySection } from "./MemorySection";
import { ModelSection } from "./ModelSection";
import { PersonaSection } from "./PersonaSection";
import { PrivacySection } from "./PrivacySection";
import { SuperSection } from "./SuperSection";
import { ToolsSection } from "./ToolsSection";
import { WorkspaceSection } from "./WorkspaceSection";

export function DotInfoDrawer({ dotId }: { dotId: DotId }) {
	const dot = useDots((s) => s.dots.find((d) => d.id === dotId));
	if (!dot) return <p className="p-4 text-sm text-fg-2">This Dot isn't available. It may have been deleted.</p>;
	const isSuper = dot.kind === "super";
	return (
		<div className="flex flex-col gap-4 pb-6" data-testid="dot-info">
			<AlwaysOnSection dot={dot} />
			<IdentitySection dot={dot} />
			<PersonaSection dot={dot} />
			<ModelSection dot={dot} />
			<ToolsSection dot={dot} />
			<MemorySection dot={dot} />
			<PrivacySection dot={dot} />
			<LinksSection dot={dot} />
			{isSuper && <SuperSection />}
			<WorkspaceSection dot={dot} />
			{!isSuper && <DangerZone dot={dot} />}
		</div>
	);
}
