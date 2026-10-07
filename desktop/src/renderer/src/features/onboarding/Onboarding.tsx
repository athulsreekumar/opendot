import { resolveBriefing } from "@shared/defaults";
import type { DotTemplate, ProviderSettings } from "@shared/types";
import { type ReactNode, useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { cn } from "@/design-system/cn";
import { Avatar, Button, Spinner, Switch, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { useSettings } from "@/stores/settings";
import { AddProviderForm } from "../settings/AddProviderDialog";

const STEPS = 5;
const PRESELECTED = ["general", "inbox", "calendar"];

function StepPane({ children }: { children: ReactNode }) {
	const [shown, setShown] = useState(false);
	useEffect(() => {
		const id = requestAnimationFrame(() => setShown(true));
		return () => cancelAnimationFrame(id);
	}, []);
	return (
		<div
			className={cn(
				"transition-all duration-300 ease-out",
				shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
			)}
		>
			{children}
		</div>
	);
}

function BrandDots() {
	return (
		<div className="flex items-end justify-center gap-2 h-10" aria-hidden="true">
			<span className="h-3 w-3 rounded-full bg-accent animate-bounce" />
			<span className="h-3 w-3 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
			<span className="h-3 w-3 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
		</div>
	);
}

export function Onboarding() {
	const [step, setStep] = useState(0);
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	const refreshModels = useSettings((s) => s.refreshModels);
	const [added, setAdded] = useState<ProviderSettings | undefined>();
	const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | undefined>();
	const [testing, setTesting] = useState(false);
	const [templates, setTemplates] = useState<DotTemplate[] | undefined>();
	const [picked, setPicked] = useState<Set<string>>(new Set(PRESELECTED));
	const [creating, setCreating] = useState(false);
	const [runBg, setRunBg] = useState(true);
	const [login, setLogin] = useState(true);
	const [finishing, setFinishing] = useState(false);
	const [briefingOn, setBriefingOn] = useState(false);

	useEffect(() => {
		if (step !== 2 || templates) return;
		api.dots
			.templates()
			.then(setTemplates)
			.catch((e) => toast({ title: "Couldn't load templates", description: errorText(e), variant: "error" }));
	}, [step, templates]);

	const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));

	const testAdded = async (p: ProviderSettings) => {
		setAdded(p);
		setTestResult(undefined);
		setTesting(true);
		try {
			setTestResult(await api.models.test(p.id));
			await refreshModels();
		} catch (e) {
			setTestResult({ ok: false, message: errorText(e) });
		} finally {
			setTesting(false);
		}
	};

	const createDots = async () => {
		setCreating(true);
		try {
			for (const t of templates ?? []) {
				if (picked.has(t.id)) await api.dots.create({ draft: t.draft, creationPrompt: t.examplePrompt });
			}
			await useDots.getState().load();
			next();
		} catch (e) {
			toast({ title: "Couldn't create Dots", description: errorText(e), variant: "error" });
		} finally {
			setCreating(false);
		}
	};

	const saveBackground = async () => {
		if (!settings) return next();
		try {
			await api.app.setLaunchAtLogin(login);
			await update({ background: { ...settings.background, runInBackground: runBg, launchAtLogin: login } });
			next();
		} catch (e) {
			toast({ title: "Couldn't save", description: errorText(e), variant: "error" });
		}
	};

	const finish = async () => {
		setFinishing(true);
		try {
			await update({
				onboardingDone: true,
				...(briefingOn ? { briefing: { ...resolveBriefing(settings), enabled: true, time: "08:00" } } : {}),
			});
			const sup = useDots.getState().superDot();
			navigate(sup ? `#/chats/${sup.id}` : "#/chats");
		} catch (e) {
			toast({ title: "Couldn't finish", description: errorText(e), variant: "error" });
			setFinishing(false);
		}
	};

	return (
		<div className="h-full w-full flex items-center justify-center bg-app p-6 od-drag">
			<div className="od-no-drag w-full max-w-[560px] rounded-xl bg-elevated shadow-lg border border-border-subtle p-8 flex flex-col gap-6">
				<StepPane key={step}>
					{step === 0 && (
						<div className="flex flex-col items-center gap-5 text-center">
							<BrandDots />
							<h1 className="text-3xl font-semibold text-fg">Meet your Dots</h1>
							<p className="text-md text-fg-2">
								A team of AI assistants that live on your computer. You choose the models, the tools, and who talks to
								whom.
							</p>
							<Button size="lg" onClick={next}>
								Get started
							</Button>
						</div>
					)}
					{step === 1 && (
						<div className="flex flex-col gap-4">
							<div>
								<h1 className="text-2xl font-semibold text-fg">Choose a brain</h1>
								<p className="text-sm text-fg-2 mt-1">
									Pick the model your Dots will think with. You can change it any time.
								</p>
							</div>
							{added ? (
								<div className="rounded-lg border border-border-subtle bg-sunken p-4 flex items-center gap-3">
									{testing ? (
										<Spinner />
									) : (
										<span className={cn("h-2.5 w-2.5 rounded-full", testResult?.ok ? "bg-success" : "bg-danger")} />
									)}
									<div className="flex-1">
										<div className="text-md font-medium text-fg">{added.label}</div>
										<div className="text-sm text-fg-2">{testing ? "Testing…" : testResult?.message}</div>
									</div>
									<Button size="sm" variant="secondary" disabled={testing} onClick={() => void testAdded(added)}>
										Test again
									</Button>
								</div>
							) : (
								<AddProviderForm onAdded={(p) => void testAdded(p)} />
							)}
							<div className="flex items-center justify-between">
								<Button variant="link" onClick={next}>
									Skip for now
								</Button>
								<Button disabled={!added || testing} onClick={next}>
									Continue
								</Button>
							</div>
						</div>
					)}
					{step === 2 && (
						<div className="flex flex-col gap-4">
							<div>
								<h1 className="text-2xl font-semibold text-fg">Pick your first Dots</h1>
								<p className="text-sm text-fg-2 mt-1">Each one is good at something. You can add more later.</p>
							</div>
							{!templates ? (
								<div className="flex justify-center p-6">
									<Spinner />
								</div>
							) : (
								<div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto">
									{templates.map((t) => {
										const on = picked.has(t.id);
										return (
											<label
												key={t.id}
												className={cn(
													"flex gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
													on ? "border-accent bg-accent-subtle" : "border-border-subtle hover:bg-hover",
												)}
											>
												<input
													type="checkbox"
													className="mt-1"
													checked={on}
													onChange={(e) =>
														setPicked((prev) => {
															const n = new Set(prev);
															if (e.target.checked) n.add(t.id);
															else n.delete(t.id);
															return n;
														})
													}
												/>
												<Avatar
													size="sm"
													color={t.draft.appearance.color}
													emoji={t.draft.appearance.emoji}
													name={t.name}
												/>
												<span className="min-w-0">
													<span className="block text-md font-medium text-fg">{t.name}</span>
													<span className="block text-xs text-fg-2 line-clamp-2">{t.description}</span>
												</span>
											</label>
										);
									})}
								</div>
							)}
							<div className="flex items-center justify-between">
								<Button variant="link" onClick={next}>
									Skip
								</Button>
								<Button loading={creating} disabled={!templates || picked.size === 0} onClick={() => void createDots()}>
									Create
								</Button>
							</div>
						</div>
					)}
					{step === 3 && (
						<div className="flex flex-col gap-4">
							<div>
								<h1 className="text-2xl font-semibold text-fg">Keep your Dots running in the background?</h1>
								<p className="text-sm text-fg-2 mt-1">
									So they can watch your inbox and calendar even when the window is closed.
								</p>
							</div>
							<Switch label="Keep running when I close the window" checked={runBg} onCheckedChange={setRunBg} />
							<Switch label="Open OpenDot when I log in" checked={login} onCheckedChange={setLogin} />
							<div className="flex justify-end">
								<Button onClick={() => void saveBackground()}>Continue</Button>
							</div>
						</div>
					)}
					{step === 4 && (
						<div className="flex flex-col gap-4">
							<h1 className="text-2xl font-semibold text-fg">Our privacy promise</h1>
							<ul className="flex flex-col gap-2 text-md text-fg-2 list-disc pl-5">
								<li>Your chats, keys and settings stay on this computer.</li>
								<li>Personal details are masked before they reach cloud models.</li>
								<li>Dots can't use tools or talk to each other unless you allow it.</li>
							</ul>
							<Switch
								label="Get a daily briefing at 8:00"
								description="SuperDot asks your Dots what matters and sends you one summary each weekday morning. You can change this in Settings."
								checked={briefingOn}
								onCheckedChange={setBriefingOn}
							/>
							<div className="flex justify-end">
								<Button size="lg" loading={finishing} onClick={() => void finish()}>
									Start chatting
								</Button>
							</div>
						</div>
					)}
				</StepPane>
				<div
					className="flex justify-center gap-1.5"
					role="progressbar"
					aria-label="Setup progress"
					aria-valuemin={1}
					aria-valuemax={STEPS}
					aria-valuenow={step + 1}
				>
					{Array.from({ length: STEPS }, (_, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: static indicator
							key={i}
							className={cn(
								"h-1.5 rounded-full transition-all duration-300",
								i === step ? "w-5 bg-accent" : "w-1.5 bg-border",
							)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
