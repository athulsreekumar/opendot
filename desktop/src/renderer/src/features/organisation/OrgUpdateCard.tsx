import type { OrgUpdateView } from "@shared/organisation";
import { navigate } from "../../app/router";
import { Badge, Button } from "../../design-system/components";
import { IconOrganisation } from "../../design-system/icons";
import { UPDATE_KIND } from "./labels";

/** Compact card in SuperDot's chat for a project update (spec 15 §8). */
export function OrgUpdateCard({ update }: { update: OrgUpdateView }) {
	const tone = update.kind === "done" ? "success" : update.kind === "failed" ? "danger" : "warning";
	return (
		<article
			aria-label={`Project update: ${update.title}`}
			data-testid="org-update-card"
			className="w-full max-w-[min(72%,640px)] rounded-bubble border-l-4 border-accent bg-bubble-in px-3 py-2.5 text-bubble-in-fg shadow-bubble"
		>
			<div className="flex items-center gap-2">
				<IconOrganisation size={14} className="shrink-0 text-accent" />
				<span className="min-w-0 flex-1 truncate text-sm font-semibold">{update.title}</span>
				<Badge variant={tone}>{UPDATE_KIND[update.kind] ?? "Update"}</Badge>
			</div>
			{update.text && <p className="od-selectable mt-1 whitespace-pre-wrap text-sm">{update.text}</p>}
			<div className="mt-2">
				<Button size="sm" variant="secondary" onClick={() => navigate(`#/organisation/${update.projectId}`)}>
					Open project
				</Button>
			</div>
		</article>
	);
}
