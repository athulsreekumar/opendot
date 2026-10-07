import type { Skill } from "@shared/organisation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Dialog, DialogFooter, Input, Select, TextArea, toast } from "@/design-system/components";
import { Markdown } from "@/features/chats/Markdown";
import { api, errorText } from "@/lib/api";
import { useOrganisation } from "@/stores/organisation";
import { Field } from "./shared-ui";

const NO_DOMAIN = "__none";

interface Draft {
	name: string;
	description: string;
	domain: string;
	body: string;
}

const EMPTY: Draft = { name: "", description: "", domain: NO_DOMAIN, body: "" };

function toDraft(s: Skill): Draft {
	return { name: s.name, description: s.description, domain: s.domain ?? NO_DOMAIN, body: s.body };
}

export function SkillDialog({
	skillId,
	onClose,
	domainName,
}: {
	skillId?: string;
	onClose: () => void;
	domainName: (id: string) => string;
}) {
	const domains = useOrganisation((s) => s.domains);
	const [id, setId] = useState<string | undefined>(skillId);
	const [skill, setSkill] = useState<Skill | null>(null);
	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [loading, setLoading] = useState(!!skillId);
	const [busy, setBusy] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const closeRef = useRef(onClose);
	closeRef.current = onClose;

	useEffect(() => {
		if (!id) return;
		let live = true;
		setLoading(true);
		api.org
			.skill(id)
			.then((s) => {
				if (!live) return;
				setSkill(s);
				setDraft(toDraft(s));
			})
			.catch((e) => {
				toast({ title: "Couldn't open the skill", description: errorText(e), variant: "error" });
				closeRef.current();
			})
			.finally(() => live && setLoading(false));
		return () => {
			live = false;
		};
	}, [id]);

	const builtin = skill?.builtin === true;
	const valid = draft.name.trim() && draft.description.trim() && draft.body.trim();
	const input = (withId: boolean) => ({
		...(withId && skill ? { id: skill.id } : {}),
		name: draft.name.trim(),
		description: draft.description.trim(),
		...(draft.domain !== NO_DOMAIN ? { domain: draft.domain } : {}),
		body: draft.body,
	});

	const guard = async (fn: () => Promise<void>, failTitle: string) => {
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			toast({ title: failTitle, description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	const save = () =>
		guard(async () => {
			await api.org.saveSkill(input(true));
			await useOrganisation.getState().refreshSkills();
			onClose();
		}, "Couldn't save the skill");

	const duplicate = () =>
		guard(async () => {
			if (!skill) return;
			const copy = await api.org.saveSkill({
				name: `${skill.name} (copy)`,
				description: skill.description,
				...(skill.domain ? { domain: skill.domain } : {}),
				body: skill.body,
			});
			await useOrganisation.getState().refreshSkills();
			setSkill(copy);
			setDraft(toDraft(copy));
			setId(copy.id);
		}, "Couldn't duplicate the skill");

	const remove = () =>
		guard(async () => {
			if (!skill) return;
			await api.org.deleteSkill(skill.id);
			await useOrganisation.getState().refreshSkills();
			await useOrganisation.getState().refreshState();
			onClose();
		}, "Couldn't delete the skill");

	const title = !skillId && !skill ? "New skill" : builtin ? (skill?.name ?? "Skill") : "Edit skill";

	return (
		<Dialog
			open
			size="lg"
			onOpenChange={(o) => !o && onClose()}
			title={title}
			description={
				builtin
					? "This skill ships with OpenDot and can't be changed. Duplicate it to make your own version."
					: undefined
			}
			footer={
				builtin ? (
					<DialogFooter>
						<Button variant="ghost" onClick={onClose}>
							Close
						</Button>
						<Button loading={busy} onClick={() => void duplicate()}>
							Duplicate to edit
						</Button>
					</DialogFooter>
				) : (
					<DialogFooter className="justify-between">
						<div>
							{skill && !confirmDelete && (
								<Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
									Delete
								</Button>
							)}
							{skill && confirmDelete && (
								<span className="flex items-center gap-2 text-sm text-fg-2">
									Delete this skill?
									<Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
										Yes, delete
									</Button>
									<Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
										Keep
									</Button>
								</span>
							)}
						</div>
						<div className="flex gap-2">
							<Button variant="ghost" onClick={onClose}>
								Cancel
							</Button>
							<Button disabled={!valid} loading={busy} onClick={() => void save()}>
								Save skill
							</Button>
						</div>
					</DialogFooter>
				)
			}
		>
			{loading ? (
				<p className="py-8 text-center text-sm text-fg-2">Loading…</p>
			) : builtin && skill ? (
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<Badge variant="muted">Built-in</Badge>
						{skill.domain && <span className="text-xs text-fg-3">{domainName(skill.domain)}</span>}
					</div>
					<p className="text-sm text-fg-2">{skill.description}</p>
					<div className="od-selectable rounded-lg border border-border-subtle bg-sunken p-4 text-sm text-fg">
						<Markdown text={skill.body} />
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					<Field label="Name" htmlFor="sk-name">
						<Input
							id="sk-name"
							value={draft.name}
							maxLength={80}
							onChange={(e) => setDraft({ ...draft, name: e.target.value })}
						/>
					</Field>
					<Field label="Description (one line the Dot sees)" htmlFor="sk-desc">
						<Input
							id="sk-desc"
							value={draft.description}
							maxLength={200}
							onChange={(e) => setDraft({ ...draft, description: e.target.value })}
						/>
					</Field>
					<div className="flex flex-col gap-1.5">
						<span className="text-sm font-medium text-fg">Domain</span>
						<Select
							aria-label="Domain"
							value={draft.domain}
							onValueChange={(v) => setDraft({ ...draft, domain: v })}
							groups={[
								{
									items: [
										{ value: NO_DOMAIN, label: "No domain (shared)" },
										...domains.map((d) => ({ value: d.id, label: d.name })),
									],
								},
							]}
						/>
					</div>
					<Field label="Playbook (markdown)" htmlFor="sk-body">
						<TextArea
							id="sk-body"
							value={draft.body}
							minRows={8}
							maxRows={16}
							autoGrow
							className="font-mono text-sm"
							onChange={(e) => setDraft({ ...draft, body: e.target.value })}
						/>
					</Field>
				</div>
			)}
		</Dialog>
	);
}
