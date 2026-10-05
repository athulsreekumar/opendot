"use client";

import clsx from "clsx";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { MacOnlyPill } from "@/components/ui/MacOnlyPill";
import { Mascot } from "@/components/ui/Mascot";
import { form as copy } from "@/lib/copy";
import type { SignupSource } from "@/lib/early-access-client";

export type EarlyAccessFormProps = {
	source: SignupSource;
	variant: "inline" | "dialog";
	onSuccess?: () => void;
};

type Status = "idle" | "loading" | "done";
type Mac = "apple-silicon" | "intel" | "unsure";
type Outcome = "success" | "duplicate";

const STORAGE_KEY = "opendot:early-access";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FIRST_DOT_MAX = 280;

function readSignedUp(): boolean {
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}
function writeSignedUp(on: boolean) {
	try {
		if (on) window.localStorage.setItem(STORAGE_KEY, "1");
		else window.localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* storage unavailable: the form still works */
	}
}

function Spinner() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5" />
			<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
		</svg>
	);
}

/** Checkmark that draws itself in. */
function DrawnCheck() {
	const [drawn, setDrawn] = useState(false);
	useEffect(() => {
		const id = requestAnimationFrame(() => setDrawn(true));
		return () => cancelAnimationFrame(id);
	}, []);
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M5 12.5l4.5 4.5L19 7.5"
				stroke="currentColor"
				strokeWidth="2.75"
				strokeLinecap="round"
				strokeLinejoin="round"
				style={{
					strokeDasharray: 24,
					strokeDashoffset: drawn ? 0 : 24,
					transition: "stroke-dashoffset 380ms cubic-bezier(0.22, 1, 0.36, 1)",
				}}
			/>
		</svg>
	);
}

export function EarlyAccessForm({ source, variant, onSuccess }: EarlyAccessFormProps) {
	const uid = useId();
	const ids = {
		email: `${uid}-email`,
		error: `${uid}-error`,
		dot: `${uid}-dot`,
		mac: `${uid}-mac`,
	};
	const mountedAt = useRef(0);
	const [email, setEmail] = useState("");
	const [firstDot, setFirstDot] = useState("");
	const [mac, setMac] = useState<Mac | "">("");
	const [honeypot, setHoneypot] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<"invalid" | "rate" | "error" | null>(null);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [signedUp, setSignedUp] = useState(false);
	const [engaged, setEngaged] = useState(false);

	useEffect(() => {
		mountedAt.current = Date.now();
		setSignedUp(readSignedUp());
	}, []);

	const showMore = variant === "dialog" || engaged;

	async function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (status !== "idle") return;
		const value = email.trim();
		if (!EMAIL_RE.test(value) || value.length > 254) {
			setError("invalid");
			return;
		}
		setError(null);
		setStatus("loading");
		try {
			const res = await fetch("/api/early-access", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: value,
					firstDot: firstDot.trim() || undefined,
					mac: mac || undefined,
					company_website: honeypot,
					// dialog mounts on demand, so measure from page load there (a fast typist must not look like a bot)
					t: variant === "dialog" ? Math.round(performance.now()) : Date.now() - mountedAt.current,
					source,
				}),
			});
			const data = (await res.json().catch(() => null)) as { ok?: boolean; duplicate?: boolean } | null;
			if (res.ok && data?.ok) {
				setStatus("done");
				const result: Outcome = data.duplicate ? "duplicate" : "success";
				writeSignedUp(true);
				window.setTimeout(() => {
					setOutcome(result);
					onSuccess?.();
				}, 750);
				return;
			}
			setStatus("idle");
			setError(res.status === 400 || res.status === 413 ? "invalid" : res.status === 429 ? "rate" : "error");
		} catch {
			setStatus("idle");
			setError("error");
		}
	}

	if (outcome) {
		return (
			<div role="status" className="flex flex-col items-center gap-2 py-2 text-center">
				<Mascot pose="cheer" size={120} />
				<p className="t-lead text-fg">{outcome === "duplicate" ? copy.duplicate : copy.success}</p>
			</div>
		);
	}

	if (signedUp && status === "idle") {
		return (
			<div className="flex flex-col items-center gap-1 py-2 text-center">
				<p className="t-lead inline-flex items-center gap-2 text-fg">
					You’re on the list <span className="text-accent">✓</span>
				</p>
				<button
					type="button"
					onClick={() => {
						writeSignedUp(false);
						setSignedUp(false);
					}}
					className="t-caption rounded-sm px-1 py-1 text-accent underline-offset-4 hover:underline"
				>
					Use another email
				</button>
			</div>
		);
	}

	const invalid = error === "invalid";
	const message =
		error === "invalid" ? copy.invalid : error === "rate" ? copy.rate : error === "error" ? copy.error : "";

	return (
		<div className="w-full">
			<form
				noValidate
				onSubmit={submit}
				onFocusCapture={() => setEngaged(true)}
				className="relative w-full text-left"
				aria-label={copy.submit}
			>
				<label htmlFor={ids.email} className="sr-only">
					{copy.emailLabel}
				</label>
				<div
					className={clsx(
						"flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:border sm:bg-card sm:p-1 sm:pl-2",
						"sm:transition-shadow sm:focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_30%,transparent)]",
						invalid ? "sm:border-[#d92d20]" : "sm:border-line",
					)}
				>
					<input
						id={ids.email}
						name="email"
						type="email"
						inputMode="email"
						autoComplete="email"
						required
						value={email}
						placeholder={copy.emailPlaceholder}
						aria-invalid={invalid || undefined}
						aria-describedby={message ? ids.error : undefined}
						onChange={(e) => {
							setEmail(e.target.value);
							setEngaged(true);
							if (error === "invalid") setError(null);
						}}
						className={clsx(
							"h-[52px] w-full min-w-0 flex-1 rounded-full border bg-card px-5 text-[17px] text-fg placeholder:text-fg-3",
							"sm:h-[44px] sm:border-0 sm:bg-transparent sm:px-3 sm:focus-visible:outline-none",
							invalid ? "border-[#d92d20]" : "border-line",
						)}
					/>
					<button
						type="submit"
						disabled={status === "loading"}
						aria-busy={status === "loading"}
						className={clsx(
							"inline-flex h-[52px] items-center justify-center rounded-full bg-accent px-7 text-[17px] font-medium text-accent-fg",
							"transition-[transform,background-color,box-shadow] duration-200 ease-out-expo hover:bg-accent-hover active:scale-[0.98]",
							"sm:h-[44px] sm:min-w-[176px] sm:shrink-0",
						)}
					>
						{status === "loading" ? (
							<>
								<Spinner />
								<span className="sr-only">{copy.submit}</span>
							</>
						) : status === "done" ? (
							<>
								<DrawnCheck />
								<span className="sr-only">{copy.submit}</span>
							</>
						) : (
							copy.submit
						)}
					</button>
				</div>

				<p
					id={ids.error}
					role={message ? "alert" : undefined}
					className={clsx("t-caption mt-2 min-h-[1.25rem] px-5", message ? "text-[#d92d20]" : "")}
				>
					{message}
				</p>

				<div
					className="grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo"
					style={{ gridTemplateRows: showMore ? "1fr" : "0fr", opacity: showMore ? 1 : 0 }}
					inert={!showMore}
				>
					<div className="min-h-0 overflow-hidden">
						<div className="flex flex-col gap-5 pt-3 pb-1">
							<div>
								<div className="mb-2 flex items-baseline justify-between gap-3 px-1">
									<label htmlFor={ids.dot} className="t-caption font-medium text-fg">
										{copy.firstDotLabel}
									</label>
									<span className="t-caption tabular-nums text-fg-3" aria-hidden="true">
										{firstDot.length}/{FIRST_DOT_MAX}
									</span>
								</div>
								<textarea
									id={ids.dot}
									name="firstDot"
									rows={3}
									maxLength={FIRST_DOT_MAX}
									value={firstDot}
									placeholder={copy.firstDotPlaceholder}
									onChange={(e) => setFirstDot(e.target.value)}
									className="w-full resize-none rounded-[var(--radius)] border border-line bg-card px-4 py-3 text-[15px] text-fg placeholder:text-fg-3"
								/>
							</div>
							<fieldset className="min-w-0">
								<legend id={ids.mac} className="t-caption mb-2 px-1 font-medium text-fg">
									{copy.macLabel}
								</legend>
								<div
									role="radiogroup"
									aria-labelledby={ids.mac}
									className="grid grid-cols-3 gap-1 rounded-full border border-line bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] p-1"
								>
									{copy.macOptions.map((o) => (
										<label key={o.value} className="relative block cursor-pointer">
											<input
												type="radio"
												name="mac"
												value={o.value}
												checked={mac === o.value}
												onChange={() => setMac(o.value as Mac)}
												onClick={() => mac === o.value && setMac("")}
												className="peer sr-only"
											/>
											<span
												className={clsx(
													"flex h-9 items-center justify-center rounded-full px-2 text-center text-[13px] font-medium text-fg-2 transition-colors duration-200",
													"peer-checked:bg-card peer-checked:text-fg peer-checked:shadow-[0_1px_3px_rgba(0,0,0,0.18)]",
													"peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]",
												)}
											>
												{o.label}
											</span>
										</label>
									))}
								</div>
							</fieldset>
						</div>
					</div>
				</div>

				{/* Honeypot: real users never see or reach this */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute top-0 left-0 h-px w-px overflow-hidden opacity-0"
				>
					<input
						type="text"
						name="company_website"
						tabIndex={-1}
						autoComplete="off"
						value={honeypot}
						onChange={(e) => setHoneypot(e.target.value)}
					/>
				</div>
			</form>

			<div className="mt-4 flex flex-col items-center gap-3 text-center">
				<MacOnlyPill detail={variant === "inline"} />
				<p className="t-caption text-fg-3">
					{copy.consent}{" "}
					<Link href="/privacy" className="text-fg-2 underline underline-offset-2 hover:text-fg">
						{copy.privacyLink}
					</Link>
				</p>
			</div>
		</div>
	);
}
