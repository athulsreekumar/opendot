import { useEffect } from "react";
import { navigate } from "@/app/router";
import { Tabs, TabsList, TabsTrigger } from "@/design-system/components";
import { useOrganisation } from "@/stores/organisation";
import { ProjectDetail } from "./ProjectDetail";
import { ProjectsView } from "./ProjectsView";
import { SetupView } from "./SetupView";
import { SkillsView } from "./SkillsView";
import { Unavailable } from "./shared-ui";
import { TeamView } from "./TeamView";

type TabId = "projects" | "team" | "skills";

function tabFor(sub?: string): TabId {
	return sub === "team" ? "team" : sub === "skills" ? "skills" : "projects";
}

export function OrganisationScreen({ sub }: { sub?: string }) {
	const org = useOrganisation((s) => s.org);
	const loaded = useOrganisation((s) => s.loaded);
	const error = useOrganisation((s) => s.error);
	const load = useOrganisation((s) => s.load);

	useEffect(() => {
		if (!loaded) void load();
	}, [loaded, load]);

	const tab = tabFor(sub);
	const unavailable = loaded && error !== null && org === null;

	let body: React.ReactNode;
	if (!loaded) body = <p className="px-2 py-12 text-center text-sm text-fg-2">Loading…</p>;
	else if (unavailable) body = <Unavailable onRetry={() => void load()} detail={error} />;
	else if (tab === "skills") body = <SkillsView />;
	else if (!org?.created) body = <SetupView />;
	else if (tab === "team") body = <TeamView />;
	else if (sub) body = <ProjectDetail projectId={sub} />;
	else body = <ProjectsView />;

	return (
		<div className="h-full overflow-y-auto" data-testid="organisation-screen">
			<div className="mx-auto w-full max-w-[960px] p-8">
				<h1 className="text-3xl font-semibold text-fg">{org?.created && org.name ? org.name : "Organisation"}</h1>
				<p className="mt-1 text-md text-fg-2">A team of Dots, one per department, led by SuperDot.</p>
				{!unavailable && (
					<Tabs
						value={tab}
						onValueChange={(v) => navigate(v === "projects" ? "#/organisation" : `#/organisation/${v}`)}
						className="mt-6"
					>
						<TabsList aria-label="Organisation sections">
							<TabsTrigger value="projects">Projects</TabsTrigger>
							<TabsTrigger value="team">Team</TabsTrigger>
							<TabsTrigger value="skills">Skills</TabsTrigger>
						</TabsList>
					</Tabs>
				)}
				<div className="mt-6">{body}</div>
			</div>
		</div>
	);
}
