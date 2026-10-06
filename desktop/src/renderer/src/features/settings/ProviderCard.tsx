import type { ProviderSettings } from "@shared/types";
import { useState } from "react";
import { cn } from "@/design-system/cn";
import { Button, Dialog, DialogFooter, Input, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";

export function ProviderCard({ provider }: { provider: ProviderSettings }) {
	const refreshModels = useSettings((s) => s.refreshModels);
	const [busy, setBusy] = useState<"test" | "discover" | "remove" | "key" | undefined>();
	const [confirm, setConfirm] = useState(false);
	const [replacing, setReplacing] = useState(false);
	const [newKey, setNewKey] = useState("");

	const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
		setBusy(kind);
		try {
			await fn();
		} catch (e) {
			toast({ title: "Something went wrong", description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	const dot = provider.lastTest ? (provider.lastTest.ok ? "bg-success" : "bg-danger") : "bg-warning";
	const dotTitle = provider.lastTest ? provider.lastTest.message : "Not tested yet";
	const count = provider.models?.length ?? 0;

	return (
		<div className="rounded-lg border border-border-subtle bg-elevated p-4 flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<span
					role="img"
					aria-label={dotTitle}
					title={dotTitle}
					className={cn("h-2.5 w-2.5 rounded-full shrink-0", dot)}
				/>
				<div className="flex-1 min-w-0">
					<div className="text-md font-medium text-fg truncate">{provider.label}</div>
					<div className="text-xs text-fg-3">{count === 1 ? "1 model" : `${count} models`}</div>
				</div>
				<Button
					size="sm"
					variant="secondary"
					loading={busy === "test"}
					onClick={() =>
						run("test", async () => {
							const r = await api.models.test(provider.id);
							await refreshModels();
							toast({
								title: r.ok ? "Connected" : "Test failed",
								description: r.message,
								variant: r.ok ? "success" : "error",
							});
						})
					}
				>
					Test
				</Button>
				{provider.kind !== "cloud" && (
					<Button
						size="sm"
						variant="secondary"
						loading={busy === "discover"}
						onClick={() =>
							run("discover", async () => {
								const found = await api.models.discover(provider.id);
								await api.models.updateProvider(provider.id, {
									models: found.map((m) => ({ id: m.id, label: m.label })),
								});
								await refreshModels();
								toast({ title: `Found ${found.length} model${found.length === 1 ? "" : "s"}`, variant: "success" });
							})
						}
					>
						Discover models
					</Button>
				)}
				<Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
					Remove
				</Button>
			</div>
			{provider.kind !== "self-hosted" || provider.hasSecret ? (
				<div className="flex items-center gap-2 text-sm">
					<span className="text-fg-2 w-8">Key</span>
					{replacing ? (
						<>
							<Input
								type="password"
								autoComplete="off"
								aria-label={`New key for ${provider.label}`}
								placeholder="Paste the new key"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value)}
							/>
							<Button
								size="sm"
								loading={busy === "key"}
								disabled={!newKey.trim()}
								onClick={() =>
									run("key", async () => {
										await api.models.setSecret(provider.id, newKey.trim());
										await refreshModels();
										setNewKey("");
										setReplacing(false);
										toast({ title: "Key replaced", variant: "success" });
									})
								}
							>
								Save
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setReplacing(false);
									setNewKey("");
								}}
							>
								Cancel
							</Button>
						</>
					) : (
						<>
							<span className="flex-1 text-fg font-mono">
								{provider.hasSecret ? `••••${provider.secretHint ?? ""}` : "No key saved"}
							</span>
							<Button size="sm" variant="ghost" onClick={() => setReplacing(true)}>
								{provider.hasSecret ? "Replace" : "Add key"}
							</Button>
						</>
					)}
				</div>
			) : null}
			<Dialog
				open={confirm}
				onOpenChange={setConfirm}
				size="sm"
				title={`Remove ${provider.label}?`}
				description="Dots using its models will switch to your default model."
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirm(false)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							loading={busy === "remove"}
							onClick={() =>
								run("remove", async () => {
									await api.models.removeProvider(provider.id);
									await refreshModels();
									setConfirm(false);
								})
							}
						>
							Remove
						</Button>
					</DialogFooter>
				}
			>
				<p className="text-sm text-fg-2">Your saved key for this provider will be deleted from this computer.</p>
			</Dialog>
		</div>
	);
}
