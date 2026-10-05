import type { Connection } from "@shared/types";
import { useState } from "react";
import { Button, Switch, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";
import { IconTile } from "./ConnectionCard";
import { GOOGLE_SPEC, GoogleSetup } from "./GoogleSetup";
import { MICROSOFT_SPEC, MicrosoftSetup } from "./MicrosoftSetup";
import type { OAuthProviderSpec } from "./OAuthSetup";

function ProviderCard({ spec, connection }: { spec: OAuthProviderSpec; connection?: Connection }) {
	const [setup, setSetup] = useState(false);
	const [busy, setBusy] = useState<string | undefined>();
	const configured = !!connection?.configured;
	const Setup = spec.type === "google" ? GoogleSetup : MicrosoftSetup;

	const run = async (key: string, fn: () => Promise<unknown>, failTitle: string) => {
		setBusy(key);
		try {
			await fn();
			await useRuntime.getState().loadConnections();
		} catch (e) {
			toast({ title: failTitle, description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	return (
		<div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-elevated p-4">
			<div className="flex items-start gap-3">
				<IconTile name={spec.type === "google" ? "mail" : "calendar"} />
				<div className="min-w-0 flex-1">
					<div className="text-md font-semibold text-fg">{spec.brand}</div>
					<p className="text-sm text-fg-2">
						{configured
							? connection?.account
								? `Connected as ${connection.account}`
								: "Set up. Sign in to connect your account."
							: `Let Dots use ${spec.features.map((f) => f.label).join(", ")}.`}
					</p>
				</div>
			</div>
			{configured && connection && (
				<div className="flex flex-col gap-2">
					{spec.features.map((f) => (
						<Switch
							key={f.id}
							label={f.label}
							checked={connection.features.includes(f.id)}
							disabled={busy === `f-${f.id}`}
							onCheckedChange={(on) =>
								void run(
									`f-${f.id}`,
									() =>
										api.connections.update(connection.id, {
											features: on ? [...connection.features, f.id] : connection.features.filter((x) => x !== f.id),
										}),
									"Couldn't save",
								)
							}
						/>
					))}
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				{!configured && <Button onClick={() => setSetup(true)}>Set up</Button>}
				{configured && connection && !connection.account && (
					<Button
						loading={busy === "in"}
						onClick={() => void run("in", () => api.connections.signIn(connection.id), "Couldn't sign in")}
					>
						Sign in with {spec.brand}
					</Button>
				)}
				{configured && connection?.account && (
					<Button
						variant="secondary"
						loading={busy === "out"}
						onClick={() => void run("out", () => api.connections.signOut(connection.id), "Couldn't sign out")}
					>
						Sign out
					</Button>
				)}
				{configured && (
					<Button variant="ghost" onClick={() => setSetup(true)}>
						Reset
					</Button>
				)}
			</div>
			<Setup open={setup} onOpenChange={setSetup} connection={connection} />
		</div>
	);
}

export function GoogleMicrosoftTab() {
	const connections = useRuntime((s) => s.connections);
	return (
		<div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
			<ProviderCard spec={GOOGLE_SPEC} connection={connections.find((c) => c.type === "google")} />
			<ProviderCard spec={MICROSOFT_SPEC} connection={connections.find((c) => c.type === "microsoft")} />
		</div>
	);
}
