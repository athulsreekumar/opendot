import type { OrgDomain, OrgTemplate } from "@shared/organisation";
import { useEffect, useMemo, useState } from "react";
import { navigate } from "@/app/router";
import { cn } from "@/design-system/cn";
import { Avatar, Button, Input, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useOrganisation } from "@/stores/organisation";
import { CheckRow, Field, Unavailable } from "./shared-ui";

function DomainAvatars({ ids, domains }: { ids: string[]; domains: OrgDomain[] }) {
	const list = ids.map((id) => domains.find((d) => d.id === id)).filter((d): d is OrgDomain => !!d);
	return (
		<div className="flex -space-x-1.5" aria-hidden>
			{list.slice(0, 8).map((d) => (
				<Avatar key={d.id} size="xs" name={d.name} emoji={d.emoji} color={d.color} className="ring-2 ring-elevated" />
			))}
			{list.length > 8 && (
				<span className="flex h-6 w-6 items-center justify-center rounded-full bg-active text-2xs text-fg-2">
					+{list.length - 8}
				</span>
			)}
		</div>
	);
}

function TemplateCard({
	t,
	domains,
	selected,
	onSelect,
}: {
	t: OrgTemplate;
	domains: OrgDomain[];
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"flex h-full w-full flex-col gap-3 rounded-lg border bg-elevated p-4 text-left transition-colors hover:bg-hover",
				selected ? "border-accent ring-2 ring-accent" : "border-border-subtle",
			)}
		>
			<span className="text-md font-semibold text-fg">{t.name}</span>
			<span className="text-sm text-fg-2">{t.description}</span>
			<DomainAvatars ids={t.domains} domains={domains} />
			<span className="text-xs text-fg-3">{t.domains.length} Dots</span>
		</button>
	);
}

export function SetupView() {
	const templates = useOrganisation((s) => s.templates);
	const domains = useOrganisation((s) => s.domains);
	const catalogLoaded = useOrganisation((s) => s.catalogLoaded);
	const [failed, setFailed] = useState<string | null>(null);
	const [templateId, setTemplateId] = useState<string>("");
	const [choosing, setChoosing] = useState(false);
	const [ticked, setTicked] = useState<string[]>([]);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);

	const loadCatalog = () => {
		setFailed(null);
		useOrganisation
			.getState()
			.loadCatalog()
			.catch((e) => setFailed(errorText(e)));
	};
	useEffect(loadCatalog, []);

	const chosen = templates.find((t) => t.id === templateId) ?? templates[0];
	const effectiveTemplate = chosen?.id ?? "";
	const domainIds = useMemo(() => (choosing ? ticked : (chosen?.domains ?? [])), [choosing, ticked, chosen]);

	const select = (t: OrgTemplate) => {
		setTemplateId(t.id);
		setTicked(t.domains);
	};

	const create = async () => {
		if (!chosen) return;
		setBusy(true);
		try {
			const org = await api.org.setup({
				templateId: effectiveTemplate,
				...(name.trim() ? { name: name.trim() } : {}),
				...(choosing ? { domains: ticked } : {}),
			});
			useOrganisation.getState().setOrg(org);
			useOrganisation.getState().setWelcome(true);
			navigate("#/organisation");
			void useOrganisation.getState().load();
		} catch (e) {
			toast({ title: "Couldn't create your team", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	if (failed) return <Unavailable onRetry={loadCatalog} detail={failed} />;
	if (!catalogLoaded) return <p className="px-2 py-12 text-center text-sm text-fg-2">Loading…</p>;

	return (
		<section aria-labelledby="org-setup-title" className="flex flex-col gap-6">
			<div>
				<h2 id="org-setup-title" className="text-xl font-semibold text-fg">
					Build your team
				</h2>
				<p className="mt-1 text-sm text-fg-2">
					Pick a starting team. OpenDot creates one Dot for each department. You decide what each Dot can touch.
				</p>
			</div>
			<ul className="grid gap-3 sm:grid-cols-2">
				{templates.map((t) => (
					<li key={t.id}>
						<TemplateCard t={t} domains={domains} selected={t.id === effectiveTemplate} onSelect={() => select(t)} />
					</li>
				))}
			</ul>
			<div>
				<Button
					variant="link"
					aria-expanded={choosing}
					onClick={() => {
						setChoosing((c) => !c);
						if (!choosing && chosen) setTicked(chosen.domains);
					}}
				>
					Choose domains
				</Button>
				{choosing && (
					<fieldset className="mt-3 rounded-lg border border-border-subtle bg-elevated p-4">
						<legend className="px-1 text-sm font-medium text-fg">Departments to include</legend>
						<div className="grid gap-2 sm:grid-cols-2">
							{domains.map((d) => (
								<CheckRow
									key={d.id}
									checked={ticked.includes(d.id)}
									onChange={(on) => setTicked((cur) => (on ? [...cur, d.id] : cur.filter((x) => x !== d.id)))}
								>
									<span aria-hidden>{d.emoji}</span>
									<span>{d.name}</span>
									<span className="truncate text-xs text-fg-3">{d.tagline}</span>
								</CheckRow>
							))}
						</div>
					</fieldset>
				)}
			</div>
			<div className="max-w-[420px]">
				<Field label="Organisation name (optional)" htmlFor="org-name">
					<Input id="org-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
				</Field>
			</div>
			<div>
				<Button loading={busy} disabled={busy || domainIds.length === 0} onClick={() => void create()}>
					Create my team
				</Button>
			</div>
		</section>
	);
}
