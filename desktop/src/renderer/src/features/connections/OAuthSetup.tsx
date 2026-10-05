import type { Connection } from "@shared/types";
import { type ReactNode, useEffect, useState } from "react";
import { Button, Dialog, DialogFooter, Input, Spinner, Switch, toast } from "@/design-system/components";
import { IconCheck } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";

export interface OAuthProviderSpec {
	type: "google" | "microsoft";
	brand: string;
	needsSecret: boolean;
	steps: ReactNode[];
	features: Array<{ id: string; label: string }>;
}

function Ext({ url, children }: { url: string; children: ReactNode }) {
	return (
		<button type="button" className="text-link hover:underline" onClick={() => void api.app.openExternal(url)}>
			{children}
		</button>
	);
}

export { Ext as ExternalLinkButton };

export function OAuthSetupDialog({
	spec,
	open,
	onOpenChange,
	connection,
}: {
	spec: OAuthProviderSpec;
	open: boolean;
	onOpenChange: (o: boolean) => void;
	connection?: Connection;
}) {
	const [step, setStep] = useState(1);
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [features, setFeatures] = useState<string[]>(spec.features.map((f) => f.id));
	const [saving, setSaving] = useState(false);
	const [conn, setConn] = useState<Connection | undefined>(connection);
	const [signState, setSignState] = useState<"idle" | "waiting" | "done">("idle");
	const [account, setAccount] = useState<string | undefined>();
	const [signError, setSignError] = useState<string | undefined>();

	useEffect(() => {
		if (open) {
			setStep(1);
			setClientId("");
			setClientSecret("");
			setFeatures(spec.features.map((f) => f.id));
			setConn(connection);
			setSignState("idle");
			setAccount(undefined);
			setSignError(undefined);
		}
	}, [open, spec, connection]);

	const canSave =
		clientId.trim().length > 0 && (!spec.needsSecret || clientSecret.trim().length > 0) && features.length > 0;

	const save = async () => {
		setSaving(true);
		try {
			const c = await api.connections.configureOAuth(spec.type, {
				clientId: clientId.trim(),
				clientSecret: spec.needsSecret ? clientSecret.trim() : undefined,
				features,
			});
			setConn(c);
			await useRuntime.getState().loadConnections();
			setStep(4);
		} catch (e) {
			toast({ title: "Couldn't save", description: errorText(e), variant: "error" });
		} finally {
			setSaving(false);
		}
	};

	const signIn = async () => {
		if (!conn) return;
		setSignState("waiting");
		setSignError(undefined);
		try {
			const r = await api.connections.signIn(conn.id);
			setAccount(r.account);
			setSignState("done");
			await useRuntime.getState().loadConnections();
		} catch (e) {
			setSignState("idle");
			setSignError(errorText(e));
		}
	};

	const footer = (
		<DialogFooter>
			{step > 1 && step < 4 && (
				<Button variant="ghost" onClick={() => setStep(step - 1)}>
					Back
				</Button>
			)}
			<Button variant="ghost" onClick={() => onOpenChange(false)}>
				{signState === "done" ? "Done" : "Cancel"}
			</Button>
			{step === 1 && <Button onClick={() => setStep(2)}>Next</Button>}
			{step === 2 && (
				<Button onClick={() => setStep(3)} disabled={!clientId.trim() || (spec.needsSecret && !clientSecret.trim())}>
					Next
				</Button>
			)}
			{step === 3 && (
				<Button onClick={save} disabled={!canSave} loading={saving}>
					Save
				</Button>
			)}
			{step === 4 && signState !== "done" && (
				<Button onClick={signIn} loading={signState === "waiting"}>
					Sign in with {spec.brand}
				</Button>
			)}
		</DialogFooter>
	);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={`Set up ${spec.brand}`}
			description={`Step ${step} of 4`}
			footer={footer}
		>
			{step === 1 && (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-fg-2">
						OpenDot uses your own {spec.brand} app, so your data never passes through anyone else.
					</p>
					<ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-fg">
						{spec.steps.map((s, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static list
							<li key={i}>{s}</li>
						))}
					</ol>
				</div>
			)}
			{step === 2 && (
				<div className="flex flex-col gap-4">
					{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
					<label className="flex flex-col gap-1 text-sm text-fg-2">
						Client ID
						<Input
							value={clientId}
							onChange={(e) => setClientId(e.target.value)}
							autoComplete="off"
							className="font-mono"
						/>
					</label>
					{spec.needsSecret && (
						// biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input
						<label className="flex flex-col gap-1 text-sm text-fg-2">
							Client secret
							<Input
								type="password"
								value={clientSecret}
								onChange={(e) => setClientSecret(e.target.value)}
								autoComplete="off"
								className="font-mono"
							/>
						</label>
					)}
				</div>
			)}
			{step === 3 && (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-fg-2">Choose what Dots can be given access to.</p>
					{spec.features.map((f) => (
						<Switch
							key={f.id}
							label={f.label}
							checked={features.includes(f.id)}
							onCheckedChange={(on) => setFeatures((cur) => (on ? [...cur, f.id] : cur.filter((x) => x !== f.id)))}
						/>
					))}
				</div>
			)}
			{step === 4 && (
				<div className="flex flex-col items-center gap-3 py-6 text-center">
					{signState === "waiting" && (
						<>
							<Spinner size={24} />
							<p className="text-sm text-fg-2">Finish signing in in your browser…</p>
						</>
					)}
					{signState === "idle" && (
						<p className="text-sm text-fg-2">Saved. Sign in to connect your {spec.brand} account.</p>
					)}
					{signState === "done" && (
						<>
							<span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle text-success">
								<IconCheck size={20} />
							</span>
							<p className="text-md font-medium text-fg">Connected{account ? ` as ${account}` : ""}</p>
						</>
					)}
					{signError && <p className="text-sm text-danger">{signError}</p>}
				</div>
			)}
		</Dialog>
	);
}
