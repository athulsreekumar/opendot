"use client";

import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import "./nav.css";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/LogoMark";
import { nav } from "@/lib/copy";
import { openEarlyAccess } from "@/lib/early-access-client";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fixed top navigation. Transparent over the hero, translucent + blurred after 40px of scroll, and switches to a
 * dark style while a `section.chapter-dark` is underneath it. Below 768px the links live in a sheet.
 */
export function Nav() {
	const [scrolled, setScrolled] = useState(false);
	const [dark, setDark] = useState(false);
	const [open, setOpen] = useState(false);
	const header = useRef<HTMLElement>(null);
	const toggle = useRef<HTMLButtonElement>(null);
	const sheetId = "nav-sheet";

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 40);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	// Which chapter is under the nav? Watch a thin strip through the middle of the bar.
	useEffect(() => {
		const sections = Array.from(document.querySelectorAll<HTMLElement>("section.chapter-dark"));
		if (!sections.length) return;
		const under = new Set<Element>();
		let io: IntersectionObserver | undefined;
		const build = () => {
			io?.disconnect();
			under.clear();
			const vh = window.innerHeight;
			io = new IntersectionObserver(
				(entries) => {
					for (const e of entries) {
						if (e.isIntersecting) under.add(e.target);
						else under.delete(e.target);
					}
					setDark(under.size > 0);
				},
				{ rootMargin: `-25px 0px -${Math.max(vh - 27, 0)}px 0px`, threshold: 0 },
			);
			for (const s of sections) io.observe(s);
		};
		build();
		window.addEventListener("resize", build);
		return () => {
			window.removeEventListener("resize", build);
			io?.disconnect();
		};
	}, []);

	const close = useCallback((restore = true) => {
		setOpen(false);
		if (restore) toggle.current?.focus();
	}, []);

	// Sheet: Esc, focus trap, close when the viewport grows past the mobile breakpoint.
	useEffect(() => {
		if (!open) return;
		const el = header.current;
		el?.querySelector<HTMLElement>("#nav-sheet a")?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				close();
			} else if (e.key === "Tab" && el) {
				const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
				if (!items.length) return;
				const first = items[0];
				const last = items[items.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last?.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first?.focus();
				}
			}
		};
		const mq = window.matchMedia("(min-width: 768px)");
		const onMq = () => mq.matches && setOpen(false);
		const onScrollClose = () => setOpen(false);
		window.addEventListener("scroll", onScrollClose, { passive: true, once: true });
		document.addEventListener("keydown", onKey);
		mq.addEventListener("change", onMq);
		return () => {
			window.removeEventListener("scroll", onScrollClose);
			document.removeEventListener("keydown", onKey);
			mq.removeEventListener("change", onMq);
		};
	}, [open, close]);

	const solid = scrolled || open;

	return (
		<header
			ref={header}
			className={clsx(
				"fixed inset-x-0 top-0 z-50 text-fg transition-[background-color,border-color,backdrop-filter] duration-300",
				dark && "chapter-dark",
			)}
		>
			<div
				aria-hidden="true"
				className={clsx(
					"absolute inset-0 -z-10 border-b transition-opacity duration-300",
					"bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] border-line",
					"[backdrop-filter:saturate(180%)_blur(20px)] [-webkit-backdrop-filter:saturate(180%)_blur(20px)]",
					solid ? "opacity-100" : "opacity-0",
				)}
			/>
			<nav aria-label="Primary" className="container-site flex h-[52px] items-center justify-between gap-4">
				<a
					href="/"
					aria-label="OpenDot home"
					className="flex items-center gap-2 rounded-md text-[19px] font-semibold tracking-[-0.03em]"
				>
					<LogoMark />
					OpenDot
				</a>

				<ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
					{nav.links.map((l) => (
						<li key={l.href}>
							<a
								href={l.href}
								className="rounded-md py-2 text-[13px] font-medium text-fg-2 transition-colors duration-200 hover:text-fg"
							>
								{l.label}
							</a>
						</li>
					))}
				</ul>

				<div className="flex items-center gap-1.5">
					<Button
						size="md"
						className="!min-h-9 !px-4 !text-[13px]"
						onClick={() => {
							setOpen(false);
							openEarlyAccess("nav");
						}}
					>
						{nav.cta}
					</Button>
					<button
						ref={toggle}
						type="button"
						aria-expanded={open}
						aria-controls={sheetId}
						aria-label={open ? "Close menu" : "Open menu"}
						onClick={() => setOpen((o) => !o)}
						className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-fg md:hidden"
					>
						{open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
					</button>
				</div>
			</nav>

			{open && (
				<>
					<button
						type="button"
						tabIndex={-1}
						aria-hidden="true"
						onClick={() => close(false)}
						className="fixed inset-x-0 top-[52px] bottom-0 -z-20 cursor-default bg-black/30 md:hidden"
					/>
					<div id={sheetId} className="od-sheet md:hidden">
						<ul className="container-site flex flex-col pt-2 pb-6">
							{nav.links.map((l) => (
								<li key={l.href} className="border-b border-line last:border-b-0">
									<a href={l.href} onClick={() => setOpen(false)} className="t-title block rounded-md py-4">
										{l.label}
									</a>
								</li>
							))}
						</ul>
					</div>
				</>
			)}
			{!open && <div id={sheetId} hidden />}
		</header>
	);
}
