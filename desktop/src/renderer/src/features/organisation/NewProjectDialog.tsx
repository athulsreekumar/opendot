import { ORG_LIMITS } from "@shared/organisation";
import { useState } from "react";
import { navigate } from "@/app/router";
import { Button, Dialog, DialogFooter, Input, TextArea, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useOrganisation } from "@/stores/organisation";
import { Field } from "./shared-ui";

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
	const [title, setTitle] = useState("");
	const [brief, setBrief] = useState("");
	const [budget, setBudget] = useState("");
	const [busy, setBusy] = useState(false);

	const budgetNum = budget.trim() === "" ? undefined : Number(budget);
	const budgetBad = budgetNum !== undefined && (!Number.isFinite(budgetNum) || budgetNum <= 0);
	const canCreate = title.trim().length > 0 && brief.trim().length > 0 && !budgetBad && !busy;

	const create = async () => {
		setBusy(true);
		try {
			const p = await api.org.createProject({
				title: title.trim(),
				brief: brief.trim(),
				...(budgetNum !== undefined ? { budgetUsd: budgetNum } : {}),
			});
			useOrganisation.getState().setProject(p);
			useOrganisation.getState().setWelcome(false);
			setTitle("");
			setBrief("");
			setBudget("");
			onOpenChange(false);
			navigate(`#/organisation/${p.id}`);
		} catch (e) {
			toast({ title: "Couldn't create the project", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="New project"
			description="Describe what you want done. SuperDot will plan it with your team, and nothing starts until you approve."
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={!canCreate} loading={busy} onClick={() => void create()}>
						Create project
					</Button>
				</DialogFooter>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Title" htmlFor="np-title">
					<Input
						id="np-title"
						value={title}
						maxLength={ORG_LIMITS.projectTitleMax}
						placeholder="Add single sign-on for customers"
						onChange={(e) => setTitle(e.target.value)}
					/>
				</Field>
				<Field label="What do you need?" htmlFor="np-brief">
					<TextArea
						id="np-brief"
						value={brief}
						minRows={4}
						autoGrow
						maxLength={ORG_LIMITS.projectBriefMax}
						placeholder="Say what you want, who it is for and what done looks like."
						onChange={(e) => setBrief(e.target.value)}
					/>
				</Field>
				<Field label="Budget in US dollars (optional)" htmlFor="np-budget">
					<Input
						id="np-budget"
						inputMode="decimal"
						value={budget}
						invalid={budgetBad}
						placeholder="No limit"
						onChange={(e) => setBudget(e.target.value)}
					/>
					{budgetBad && <p className="text-xs text-danger">Enter an amount above zero, or leave it empty.</p>}
				</Field>
			</div>
		</Dialog>
	);
}
