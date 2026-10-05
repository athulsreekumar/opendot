"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startScroll, stopScroll } from "@/components/motion/SmoothScroll";
import { Icon, X } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { finalCta } from "@/lib/copy";
import { OPEN_EARLY_ACCESS, type SignupSource } from "@/lib/early-access-client";
import { EarlyAccessForm } from "./EarlyAccessForm";

const FOCUSABLE =
	'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const SOURCES: SignupSource[] = ["hero", "nav", "final", "section"];

function reduced() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EarlyAccessDialog() {
	const [open, setOpen] = useState(false);
	const [source, setSource] = useState<SignupSource>("nav");
	const cardRef = useRef<HTMLDivElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);
	const opener = useRef<HTMLElement | null>(null);
	const closing = useRef(false);
	const closeTimer = useRef<number | undefined>(undefined);

	useEffect(() => {
		const onOpen = (e: Event) => {
			const s = (e as CustomEvent<{ source?: SignupSource }>).detail?.source;
			setSource(s && SOURCES.includes(s) ? s : "nav");
			if (!open) opener.current = document.activeElement as HTMLElement | null;
			closing.current = false;
			setOpen(true);
		};
		window.addEventListener(OPEN_EARLY_ACCESS, onOpen);
		return () => window.removeEventListener(OPEN_EARLY_ACCESS, onOpen);
	}, [open]);

	const close = useCallback(() => {
		if (closing.current) return;
		closing.current = true;
		window.clearTimeout(closeTimer.current);
		const card = cardRef.current;
		const backdrop = backdropRef.current;
		const finish = () => {
			setOpen(false);
			startScroll();
			document.body.style.overflow = "";
			const el = opener.current;
			opener.current = null;
			if (el && document.contains(el)) el.focus();
		};
		if (!card || !backdrop) return finish();
		const dur = reduced() ? 120 : 200;
		const opts = { duration: dur, easing: "ease-in", fill: "forwards" as const };
		backdrop.animate([{ opacity: 1 }, { opacity: 0 }], opts);
		const a = card.animate(
			reduced()
				? [{ opacity: 1 }, { opacity: 0 }]
				: [
						{ opacity: 1, transform: "scale(1)" },
						{ opacity: 0, transform: "scale(0.97)" },
					],
			opts,
		);
		a.onfinish = finish;
	}, []);

	// Entrance animation, scroll lock, initial focus.
	useEffect(() => {
		if (!open) return;
		stopScroll();
		document.body.style.overflow = "hidden";
		const card = cardRef.current;
		const backdrop = backdropRef.current;
		const opts = {
			duration: reduced() ? 120 : 250,
			easing: "cubic-bezier(0.22, 1, 0.36, 1)",
			fill: "backwards" as const,
		};
		backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], opts);
		card?.animate(
			reduced()
				? [{ opacity: 0 }, { opacity: 1 }]
				: [
						{ opacity: 0, transform: "scale(0.96)" },
						{ opacity: 1, transform: "scale(1)" },
					],
			opts,
		);
		card?.querySelector<HTMLInputElement>("input[type=email]")?.focus({ preventScroll: true });
		return () => {
			window.clearTimeout(closeTimer.current);
		};
	}, [open]);

	// Esc + focus trap.
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				close();
				return;
			}
			if (e.key !== "Tab") return;
			const nodes = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
				(n) => !n.closest("[inert]") && n.offsetParent !== null,
			);
			if (!nodes.length) return;
			const first = nodes[0] as HTMLElement;
			const last = nodes[nodes.length - 1] as HTMLElement;
			const active = document.activeElement;
			if (e.shiftKey && (active === first || !cardRef.current?.contains(active))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (active === last || !cardRef.current?.contains(active))) {
				e.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, close]);

	if (!open || typeof document === "undefined") return null;

	return createPortal(
		<div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4">
			<div
				ref={backdropRef}
				aria-hidden="true"
				onClick={close}
				className="fixed inset-0 bg-black/60 backdrop-blur-md"
			/>
			<div
				ref={cardRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="early-access-title"
				className="relative my-auto w-full max-w-[520px] rounded-[var(--radius-lg)] bg-card px-6 pt-8 pb-7 text-fg shadow-window sm:px-9"
			>
				<button
					type="button"
					onClick={close}
					aria-label="Close"
					className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] hover:text-fg"
				>
					<Icon as={X} size={20} />
				</button>
				<div className="flex flex-col items-center text-center">
					<Mascot pose="envelope" size={96} />
					<h2 id="early-access-title" className="t-title mt-1">
						Get early access
					</h2>
					<p className="t-body mt-2 mb-6 text-fg-2">{finalCta.lead}</p>
				</div>
				<EarlyAccessForm
					source={source}
					variant="dialog"
					onSuccess={() => {
						closeTimer.current = window.setTimeout(close, 2500);
					}}
				/>
			</div>
		</div>,
		document.body,
	);
}
