import type { Dot } from "@shared/types";
import { Button, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { isMac, isWindows } from "@/lib/platform";
import { SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

export function WorkspaceSection({ dot }: { dot: Dot }) {
	const { save, saved } = useDotSaver(dot.id);
	const act = async (fn: () => Promise<unknown>) => {
		try {
			await fn();
		} catch (e) {
			toast({ title: "That didn't work", description: errorText(e), variant: "error" });
		}
	};
	return (
		<SectionCard
			title="Workspace"
			description="The folder this Dot works in by default."
			saved={saved}
			testId="section-workspace"
		>
			<p className="od-selectable break-all rounded-md bg-sunken p-3 font-mono text-xs text-fg">{dot.workspaceDir}</p>
			<div className="flex gap-2">
				<Button
					variant="secondary"
					onClick={() =>
						void act(async () => {
							const p = await api.app.pickFolder({ title: "Choose a workspace folder" });
							if (p) save({ workspaceDir: p });
						})
					}
				>
					Change…
				</Button>
				<Button variant="ghost" onClick={() => void act(() => api.app.revealPath(dot.workspaceDir))}>
					{isMac ? "Reveal in Finder" : isWindows ? "Show in File Explorer" : "Show in folder"}
				</Button>
			</div>
		</SectionCard>
	);
}
