"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startScroll, stopScroll } from "@/components/motion/SmoothScroll";
import { Screenshot } from "@/components/ui/Screenshot";
import "./film-dialog.css";

const FOCUSABLE = 'button:not([disabled]), a[href], video[controls], [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen film player. Mount it only while open (`{open && <FilmDialog onClose=… />}`) or pass `open`.
 * Portal + dark blurred backdrop, Esc closes, focus is trapped and returned to the opener, page scroll (Lenis) is
 * frozen, and the video is unloaded on close. Falls back to a "coming soon" state if the film can't load.
 */
export function FilmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [mounted, setMounted] = useState(false);
	const [failed, setFailed] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const video = useRef<HTMLVideoElement>(null);
	const closeBtn = useRef<HTMLButtonElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (!open) return;
		setFailed(false);
		const opener = document.activeElement as HTMLElement | null;
		stopScroll();
		const html = document.documentElement;
		const prevOverflow = html.style.overflow;
		html.style.overflow = "hidden";
		closeBtn.current?.focus();

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onCloseRef.current();
			} else if (e.key === "Tab" && root.current) {
				const items = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE));
				if (!items.length) return;
				const first = items[0];
				const last = items[items.length - 1];
				const active = document.activeElement;
				if (!root.current.contains(active)) {
					e.preventDefault();
					first?.focus();
				} else if (e.shiftKey && active === first) {
					e.preventDefault();
					last?.focus();
				} else if (!e.shiftKey && active === last) {
					e.preventDefault();
					first?.focus();
				}
			}
		};
		document.addEventListener("keydown", onKey);

		const v = video.current;
		return () => {
			document.removeEventListener("keydown", onKey);
			if (v) {
				v.pause();
				v.removeAttribute("src");
				for (const s of Array.from(v.querySelectorAll("source"))) s.removeAttribute("src");
				v.load();
			}
			html.style.overflow = prevOverflow;
			startScroll();
			opener?.focus?.({ preventScroll: true });
		};
	}, [open]);

	if (!mounted || !open) return null;

	return createPortal(
		<div
			ref={root}
			role="dialog"
			aria-modal="true"
			aria-label="The OpenDot film"
			className="od-film chapter-dark fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-10"
		>
			<button
				type="button"
				tabIndex={-1}
				aria-hidden="true"
				onClick={onClose}
				className="absolute inset-0 cursor-default bg-black/80 [backdrop-filter:blur(24px)_saturate(120%)] [-webkit-backdrop-filter:blur(24px)_saturate(120%)]"
			/>
			<button
				ref={closeBtn}
				type="button"
				onClick={onClose}
				aria-label="Close film"
				className="absolute top-4 right-4 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors hover:bg-white/22 md:top-6 md:right-6"
			>
				<X size={22} strokeWidth={1.75} />
			</button>

			<div
				className="od-film-stage relative w-full max-w-[1280px] overflow-hidden rounded-xl bg-black shadow-window"
				style={{ aspectRatio: "16 / 9" }}
			>
				{failed ? (
					<div className="absolute inset-0">
						<div className="size-full opacity-40 [&>div]:!aspect-auto">
							<Screenshot name="sidebar-full" alt="" theme="dark" />
						</div>
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 px-6 text-center">
							<p className="t-title text-white">The film is coming soon</p>
							<p className="t-body max-w-[34ch] text-white/70">
								We’re putting the finishing touches on it. Check back shortly.
							</p>
						</div>
					</div>
				) : (
					<video
						ref={video}
						controls
						autoPlay
						playsInline
						preload="auto"
						poster="/film/film-poster.jpg"
						className="size-full bg-black object-contain"
						onError={() => setFailed(true)}
					>
						<source src="/film/opendot-film-1080.mp4" type="video/mp4" />
						<source src="/film/opendot-film.webm" type="video/webm" onError={() => setFailed(true)} />
						<track kind="captions" src="/film/film.vtt" srcLang="en" label="English" default />
					</video>
				)}
			</div>
		</div>,
		document.body,
	);
}
