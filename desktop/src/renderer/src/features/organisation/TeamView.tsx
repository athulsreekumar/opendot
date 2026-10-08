import type { OrgDomain, OrgMember } from "@shared/organisation";
import { useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { Avatar, Badge, Button, Dialog, DialogFooter, Select, toast } from "@/design-system/components";
import { IconPlus } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { useOrganisation } from "@/stores/organisation";
import { useMemberLookup } from "./members";
import { Callout, CheckRow } from "./shared-ui";

const SHOW_SKILLS = 4;

function domainName(domains: OrgDomain[], id: string): string {
	return domains.find((d) => d.id === id)?.name ?? id;
}

function MemberCard({ m, onSkills, onRemove }: { m: OrgMember; onSkills: () => void; onRemove: () => void }) {
	const info = useMemberLookup()(m.dotId);
	const domains = useOrganisation((s) => s.domains);
	const skills = useOrganisation((s) => s.skills);
	const names = m.skillIds.map((id) => skills.find((s) => s.id === id)?.name ?? id);
	return (
		<article
			aria-label={info.name}
			className="flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-elevated p-4"
		>
			<div className="flex items-center gap-3">
				<Avatar size="md" name={info.name} icon={info.icon} color={info.color} />
				<div className="min-w-0">
					<h3 className="truncate text-md font-semibold text-fg">{info.name}</h3>
					<p className="truncate text-xs text-fg-3">
						{domains.find((d) => d.id === m.domain)?.tagline ?? domainName(domains, m.domain)}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{names.length === 0 && <span className="text-xs text-fg-3">No skills yet</span>}
				{names.slice(0, SHOW_SKILLS).map((n) => (
					<Badge key={n} variant="muted">
						{n}
					</Badge>
				))}
				{names.length > SHOW_SKILLS && <Badge variant="outline">+{names.length - SHOW_SKILLS}</Badge>}
			</div>
			<div className="mt-auto flex flex-wrap gap-2">
				<Button size="sm" variant="secondary" onClick={() => navigate(`#/chats/${m.dotId}`)}>
					Open chat
				</Button>
				<Button size="sm" variant="ghost" onClick={onSkills}>
					Edit skills
				</Button>
				<Button size="sm" variant="ghost" className="text-danger" onClick={onRemove}>
					Remove
				</Button>
			</div>
		</article>
	);
}

function MemberSkillsDialog({ member, onClose }: { member: OrgMember | null; onClose: () => void }) {
	const skills = useOrganisation((s) => s.skills);
	const domains = useOrganisation((s) => s.domains);
	const [ids, setIds] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		setIds(member?.skillIds ?? []);
	}, [member]);
	const groups = new Map<string, typeof skills>();
	for (const s of skills) {
		const k = s.domain ?? "";
		groups.set(k, [...(groups.get(k) ?? []), s]);
	}
	const save = async () => {
		if (!member) return;
		setBusy(true);
		try {
			await api.org.setMemberSkills(member.dotId, ids);
			await useOrganisation.getState().refreshState();
			onClose();
		} catch (e) {
			toast({ title: "Couldn't save skills", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog
			open={!!member}
			onOpenChange={(o) => !o && onClose()}
			title="Edit skills"
			description="The Dot sees the name of each skill and reads the full playbook only when it needs it."
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button loading={busy} onClick={() => void save()}>
						Save skills
					</Button>
				</DialogFooter>
			}
		>
			<div className="flex flex-col gap-4">
				{skills.length === 0 && <p className="text-sm text-fg-2">There are no skills in the library yet.</p>}
				{[...groups.entries()].map(([k, list]) => (
					<fieldset key={k || "shared"}>
						<legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-3">
							{k ? domainName(domains, k) : "Shared"}
						</legend>
						<div className="flex flex-col gap-1.5">
							{list.map((s) => (
								<CheckRow
									key={s.id}
									checked={ids.includes(s.id)}
									onChange={(on) => setIds((cur) => (on ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
								>
									<span>{s.name}</span>
								</CheckRow>
							))}
						</div>
					</fieldset>
				))}
			</div>
		</Dialog>
	);
}

function AddDomainDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
	const domains = useOrganisation((s) => s.domains);
	const members = useOrganisation((s) => s.org?.members ?? []);
	const dots = useDots((s) => s.dots);
	const [domain, setDomain] = useState("");
	const [useExisting, setUseExisting] = useState(false);
	const [dotId, setDotId] = useState("");
	const [busy, setBusy] = useState(false);

	const free = domains.filter((d) => !members.some((m) => m.domain === d.id));
	const candidates = dots.filter((d) => d.kind !== "super" && !d.archived && !members.some((m) => m.dotId === d.id));

	const add = async () => {
		setBusy(true);
		try {
			await api.org.addMember({ domain, ...(useExisting && dotId ? { dotId: dotId as OrgMember["dotId"] } : {}) });
			await useOrganisation.getState().refreshState();
			setDomain("");
			setDotId("");
			setUseExisting(false);
			onOpenChange(false);
		} catch (e) {
			toast({ title: "Couldn't add the domain", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Add a domain"
			description="Add one more department to your team."
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button loading={busy} disabled={!domain || (useExisting && !dotId)} onClick={() => void add()}>
						Add to team
					</Button>
				</DialogFooter>
			}
		>
			<div className="flex flex-col gap-4">
				{free.length === 0 ? (
					<p className="text-sm text-fg-2">Your team already covers every department.</p>
				) : (
					<div className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-fg">Department</span>
						<Select
							aria-label="Department"
							value={domain}
							placeholder="Choose a department"
							onValueChange={setDomain}
							groups={[{ items: free.map((d) => ({ value: d.id, label: d.name, description: d.tagline })) }]}
						/>
					</div>
				)}
				<CheckRow checked={useExisting} onChange={setUseExisting} disabled={candidates.length === 0}>
					<span>Use an existing Dot</span>
				</CheckRow>
				{useExisting && (
					<Select
						aria-label="Existing Dot"
						value={dotId}
						placeholder="Choose a Dot"
						onValueChange={setDotId}
						groups={[{ items: candidates.map((d) => ({ value: d.id, label: d.name })) }]}
					/>
				)}
			</div>
		</Dialog>
	);
}

export function TeamView() {
	const members = useOrganisation((s) => s.org?.members ?? []);
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<OrgMember | null>(null);
	const [removing, setRemoving] = useState<OrgMember | null>(null);
	const lookup = useMemberLookup();
	const [failed, setFailed] = useState<string | null>(null);

	useEffect(() => {
		useOrganisation
			.getState()
			.loadCatalog()
			.catch((e) => setFailed(errorText(e)));
		void useOrganisation
			.getState()
			.refreshSkills()
			.catch(() => undefined);
	}, []);

	const remove = async () => {
		if (!removing) return;
		try {
			await api.org.removeMember(removing.dotId);
			await useOrganisation.getState().refreshState();
			setRemoving(null);
		} catch (e) {
			toast({ title: "Couldn't remove them", description: errorText(e), variant: "error" });
		}
	};

	return (
		<section aria-label="Team" className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<h2 className="flex-1 text-xl font-semibold text-fg">Team</h2>
				<Button leadingIcon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
					Add a domain
				</Button>
			</div>
			{failed && <Callout tone="warning">Some details couldn't be loaded. {failed}</Callout>}
			{members.length === 0 ? (
				<p className="py-8 text-center text-sm text-fg-2">Nobody is on the team yet.</p>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2">
					{members.map((m) => (
						<li key={m.dotId}>
							<MemberCard m={m} onSkills={() => setEditing(m)} onRemove={() => setRemoving(m)} />
						</li>
					))}
				</ul>
			)}
			<AddDomainDialog open={adding} onOpenChange={setAdding} />
			<MemberSkillsDialog member={editing} onClose={() => setEditing(null)} />
			<Dialog
				open={!!removing}
				onOpenChange={(o) => !o && setRemoving(null)}
				size="sm"
				title={`Remove ${lookup(removing?.dotId).name}?`}
				description="They leave the organisation. The Dot itself, its chat and its history are kept."
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setRemoving(null)}>
							Keep them
						</Button>
						<Button variant="danger" onClick={() => void remove()}>
							Remove from organisation
						</Button>
					</DialogFooter>
				}
			>
				{null}
			</Dialog>
		</section>
	);
}
