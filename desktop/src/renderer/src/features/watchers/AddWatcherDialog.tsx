import type { DotEventView, DotId, Watcher, WatcherConfig, WatcherType } from "@shared/types";
import { useEffect, useState } from "react";
import { cn } from "@/design-system/cn";
import { Button, Dialog, Input, toast } from "@/design-system/components";
import { IconCopy } from "@/design-system/icons";
import { Field } from "@/features/dot-info/ui";
import { api, errorText } from "@/lib/api";
import { defaultConfig, type FormExtra, validateConfig, WatcherForm, watcherIcon } from "./watcher-forms";

type TypeInfo = Awaited<ReturnType<typeof api.watchers.types>>[number];

export function AddWatcherDialog({
	open,
	onOpenChange,
	dotId,
	watcher,
	presetLabel,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dotId: DotId;
	/** When set, the dialog edits this watcher (type can't change). */
	watcher?: Watcher;
	presetLabel?: string;
	onSaved?: (w: Watcher) => void;
}) {
	const [types, setTypes] = useState<TypeInfo[]>([]);
	const [type, setType] = useState<WatcherType | undefined>(watcher?.type);
	const [config, setConfig] = useState<WatcherConfig>(watcher?.config ?? {});
	const [label, setLabel] = useState(watcher?.label ?? presetLabel ?? "");
	const [interval, setIntervalSec] = useState<number | undefined>(watcher?.intervalSec);
	const [extra, setExtra] = useState<FormExtra>({ readOnlyConfirmed: false });
	const [busy, setBusy] = useState(false);
	const [testing, setTesting] = useState(false);
	const [result, setResult] = useState<{ ok: boolean; message: string; sample?: DotEventView[] }>();
	const [webhook, setWebhook] = useState<{ url: string; curl: string }>();

	useEffect(() => {
		if (!open) return;
		void api.watchers
			.types()
			.then(setTypes)
			.catch(() => undefined);
	}, [open]);

	const info = types.find((t) => t.type === type);
	const hasInterval = Boolean(info && !info.push && type !== "schedule");
	const problem = type ? validateConfig(type, config, extra) : "Pick what to watch.";

	const pick = (t: TypeInfo) => {
		setType(t.type);
		setConfig(defaultConfig(t.type));
		setIntervalSec(t.defaultIntervalSec);
		setResult(undefined);
		setLabel((l) => l || (presetLabel ?? ""));
	};

	const runTest = async () => {
		if (!type) return;
		setTesting(true);
		setResult(undefined);
		try {
			setResult(await api.watchers.test({ type, config, dotId }));
		} catch (e) {
			setResult({ ok: false, message: errorText(e) });
		} finally {
			setTesting(false);
		}
	};

	const save = async () => {
		if (!type || problem) return;
		setBusy(true);
		try {
			const finalLabel = label.trim() || info?.label || type;
			const intervalSec = hasInterval
				? Math.max(interval ?? info?.defaultIntervalSec ?? 60, info?.minIntervalSec ?? 1)
				: undefined;
			const saved = watcher
				? await api.watchers.update(watcher.id, { label: finalLabel, config, ...(intervalSec ? { intervalSec } : {}) })
				: await api.watchers.create({
						dotId,
						type,
						label: finalLabel,
						config,
						...(intervalSec ? { intervalSec } : {}),
					});
			onSaved?.(saved);
			if (type === "local-webhook" && !watcher) {
				setWebhook(await api.watchers.webhookInfo(saved.id));
			} else {
				onOpenChange(false);
			}
		} catch (e) {
			toast({ title: "Couldn't save the watcher", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	if (webhook) {
		return (
			<Dialog
				open={open}
				onOpenChange={onOpenChange}
				title="Webhook ready"
				description="Send a POST to this address whenever you want your Dot to hear about something."
				footer={
					<div className="flex justify-end">
						<Button onClick={() => onOpenChange(false)}>Done</Button>
					</div>
				}
			>
				<div className="flex flex-col gap-3">
					<Field label="Address">
						<p className="od-selectable break-all font-mono text-sm text-fg">{webhook.url}</p>
					</Field>
					<Field label="Try it">
						<pre className="od-selectable whitespace-pre-wrap break-all rounded-md bg-sunken p-3 font-mono text-xs text-fg">
							{webhook.curl}
						</pre>
					</Field>
					<div>
						<Button
							variant="secondary"
							leadingIcon={<IconCopy size={14} />}
							onClick={() => {
								void navigator.clipboard?.writeText(webhook.curl);
								toast({ title: "Copied", variant: "success" });
							}}
						>
							Copy curl command
						</Button>
					</div>
				</div>
			</Dialog>
		);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={watcher ? "Edit watcher" : "Add a watcher"}
			description="Watchers tell your Dot when something changes."
			footer={
				<div className="flex items-center justify-between gap-2">
					<Button
						variant="secondary"
						disabled={!type || Boolean(problem) || testing}
						loading={testing}
						onClick={() => void runTest()}
					>
						Test
					</Button>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button loading={busy} disabled={!type || Boolean(problem)} onClick={() => void save()}>
							Save
						</Button>
					</div>
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				{!watcher && (
					<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Watcher type">
						{types.map((t) => (
							// biome-ignore lint/a11y/useSemanticElements: styled card radio
							<button
								key={t.type}
								type="button"
								role="radio"
								aria-checked={t.type === type}
								disabled={!t.available}
								onClick={() => pick(t)}
								className={cn(
									"flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
									t.type === type ? "border-accent bg-accent-subtle" : "border-border-subtle hover:bg-hover",
								)}
							>
								<span className="flex items-center gap-1.5 text-sm font-medium text-fg">
									{watcherIcon(t.type, 14)} {t.label}
								</span>
								{!t.available && t.reason && <span className="text-xs text-fg-3">{t.reason}</span>}
							</button>
						))}
					</div>
				)}
				{type && (
					<>
						<Field label="Name">
							<Input
								aria-label="Watcher name"
								value={label}
								placeholder={info?.label}
								onChange={(e) => setLabel(e.target.value)}
							/>
						</Field>
						<WatcherForm type={type} config={config} onChange={setConfig} extra={extra} onExtra={setExtra} />
						{hasInterval && info && (
							<Field label="Check every (seconds)" hint={`At least ${info.minIntervalSec} s.`}>
								<Input
									aria-label="Interval seconds"
									type="number"
									min={info.minIntervalSec}
									value={String(interval ?? info.defaultIntervalSec)}
									onChange={(e) => setIntervalSec(Number(e.target.value))}
								/>
							</Field>
						)}
						{problem && <p className="text-sm text-fg-3">{problem}</p>}
						{result && (
							<div
								className={cn(
									"rounded-md px-3 py-2 text-sm",
									result.ok ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
								)}
								role="status"
							>
								<p>{result.message}</p>
								{result.sample && result.sample.length > 0 && (
									<ul className="mt-1 list-disc pl-5 text-fg-2">
										{result.sample.slice(0, 5).map((s) => (
											<li key={s.id}>{s.title}</li>
										))}
									</ul>
								)}
							</div>
						)}
					</>
				)}
			</div>
		</Dialog>
	);
}
