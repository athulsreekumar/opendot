import type { Dot } from "@shared/types";
import { useState } from "react";
import { navigate } from "@/app/router";
import { Button, Dialog, Input, toast } from "@/design-system/components";
import { errorText } from "@/lib/api";
import { useChat } from "@/stores/chat";
import { useDots } from "@/stores/dots";
import { SectionCard } from "./ui";

type Confirm = "clear" | "archive" | "delete" | undefined;

export function DangerZone({ dot }: { dot: Dot }) {
	const [confirm, setConfirm] = useState<Confirm>();
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);

	const close = () => {
		setConfirm(undefined);
		setTyped("");
	};

	const run = async () => {
		setBusy(true);
		try {
			if (confirm === "clear") {
				await useChat.getState().clear(dot.id);
				toast({ title: "Chat cleared", variant: "success" });
			} else if (confirm === "archive") {
				await useDots.getState().update(dot.id, { archived: true });
				navigate("#/chats");
				toast({ title: `${dot.name} archived`, variant: "success" });
			} else if (confirm === "delete") {
				await useDots.getState().remove(dot.id);
				navigate("#/chats");
				toast({ title: `${dot.name} deleted`, variant: "success" });
			}
			close();
		} catch (e) {
			toast({ title: "That didn't work", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	const copy = {
		clear: {
			title: "Clear this chat?",
			body: "All messages with this Dot are removed. Its memory and settings stay.",
			cta: "Clear chat",
		},
		archive: {
			title: "Archive this Dot?",
			body: "It disappears from your list and stops working in the background.",
			cta: "Archive",
		},
		delete: {
			title: `Delete ${dot.name}?`,
			body: "This removes the Dot, its chat and its memory for good.",
			cta: "Delete Dot",
		},
	} as const;
	const c = confirm ? copy[confirm] : undefined;
	const canRun = confirm !== "delete" || typed.trim().toLowerCase() === dot.name.toLowerCase();

	return (
		<SectionCard title="Danger zone" testId="section-danger">
			<div className="flex flex-wrap gap-2">
				<Button variant="secondary" onClick={() => setConfirm("clear")}>
					Clear chat
				</Button>
				<Button variant="secondary" onClick={() => setConfirm("archive")}>
					Archive
				</Button>
				<Button variant="danger" onClick={() => setConfirm("delete")}>
					Delete
				</Button>
			</div>
			<Dialog
				open={Boolean(confirm)}
				onOpenChange={(o) => !o && close()}
				size="sm"
				title={c?.title ?? ""}
				description={c?.body}
				footer={
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={close}>
							Cancel
						</Button>
						<Button
							variant={confirm === "delete" ? "danger" : "primary"}
							loading={busy}
							disabled={!canRun}
							onClick={() => void run()}
						>
							{c?.cta}
						</Button>
					</div>
				}
			>
				{confirm === "delete" && (
					<div className="flex flex-col gap-2">
						<label htmlFor="confirm-name" className="text-sm text-fg-2">
							Type <strong className="text-fg">{dot.name}</strong> to confirm.
						</label>
						<Input id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} />
					</div>
				)}
			</Dialog>
		</SectionCard>
	);
}
