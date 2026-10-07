import type { DotId } from "@shared/types";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/design-system/cn";
import { NewDotDialog } from "@/features/new-dot/NewDotDialog";
import { SettingsNav } from "@/features/settings/SettingsNav";
import { useDots } from "@/stores/dots";
import { useUi } from "@/stores/ui";
import { ListPane } from "./ListPane";
import { MainPane } from "./MainPane";
import { NavRail } from "./NavRail";
import { RightDrawer } from "./RightDrawer";
import { navigate, type Route } from "./router";

const OVERLAY_BREAKPOINT = 1100;

function useWindowWidth(): number {
	const [w, setW] = useState(() => window.innerWidth);
	useEffect(() => {
		const on = () => setW(window.innerWidth);
		window.addEventListener("resize", on);
		return () => window.removeEventListener("resize", on);
	}, []);
	return w;
}

function focusSearch() {
	const el = document.getElementById("dot-search") as HTMLInputElement | null;
	el?.focus();
	el?.select();
}

function useGlobalShortcuts(route: Route) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			const ui = useUi.getState();
			const key = e.key.toLowerCase();
			const visible = () => useDots.getState().dots.filter((d) => !d.archived);

			if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
				e.preventDefault();
				const list = visible();
				if (list.length === 0) return;
				const current = route.name === "chats" ? list.findIndex((d) => d.id === route.dotId) : -1;
				const delta = e.key === "ArrowUp" ? -1 : 1;
				const next =
					current === -1 ? (delta === 1 ? 0 : list.length - 1) : (current + delta + list.length) % list.length;
				const target = list[next];
				if (target) navigate(`#/chats/${target.id}`);
				return;
			}
			if (e.altKey) return;

			if (e.shiftKey && key === "c") {
				e.preventDefault();
				navigate("#/connections");
				return;
			}
			if (e.shiftKey) return;

			if (key === "n") {
				e.preventDefault();
				ui.setNewDotOpen(true);
			} else if (key === "k") {
				e.preventDefault();
				if (route.name !== "chats") navigate("#/chats");
				setTimeout(focusSearch, 0);
			} else if (key === "i") {
				if (route.name === "chats" && route.dotId) {
					e.preventDefault();
					ui.toggleDrawer();
				}
			} else if (key === ",") {
				e.preventDefault();
				navigate("#/settings/general");
			} else if (key === "l") {
				e.preventDefault();
				navigate("#/links");
			} else if (/^[1-9]$/.test(key)) {
				const target = visible()[Number(key) - 1];
				if (target) {
					e.preventDefault();
					navigate(`#/chats/${target.id}`);
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [route]);
}

function ListWidthHandle() {
	const width = useUi((s) => s.listWidth);
	const setWidth = useUi((s) => s.setListWidth);
	const [dragging, setDragging] = useState(false);

	const onPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			const startX = e.clientX;
			const startW = width;
			setDragging(true);
			const move = (ev: PointerEvent) => setWidth(startW + ev.clientX - startX);
			const up = () => {
				setDragging(false);
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", up);
			};
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", up);
		},
		[width, setWidth],
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: interactive splitter needs a focusable div
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize list"
			aria-valuenow={width}
			aria-valuemin={300}
			aria-valuemax={480}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onDoubleClick={() => setWidth(360)}
			onKeyDown={(e) => {
				if (e.key === "ArrowLeft") setWidth(width - 16);
				if (e.key === "ArrowRight") setWidth(width + 16);
			}}
			className={cn(
				"od-no-drag absolute right-[-2px] top-0 z-sticky h-full w-1 cursor-col-resize transition-colors",
				"hover:bg-accent/40",
				dragging && "bg-accent/60",
			)}
		/>
	);
}

export function AppShell({ route }: { route: Route }) {
	const listWidth = useUi((s) => s.listWidth);
	const drawerOpen = useUi((s) => s.drawerOpen);
	const windowWidth = useWindowWidth();

	useGlobalShortcuts(route);

	const hideList =
		route.name === "links" || route.name === "activity" || route.name === "approvals" || route.name === "connections";
	const showSettingsNav = route.name === "settings";
	const showDrawer = route.name === "chats" && Boolean(route.dotId) && drawerOpen;
	const overlay = windowWidth < OVERLAY_BREAKPOINT;
	const dotId = route.name === "chats" ? route.dotId : undefined;

	return (
		<div className="flex h-full w-full overflow-hidden bg-app text-fg">
			<NavRail route={route} />
			{!hideList && (
				<aside
					className="relative flex h-full shrink-0 flex-col border-r border-border-subtle bg-sidebar"
					style={{ width: listWidth }}
				>
					{showSettingsNav ? (
						<>
							<div className="od-drag h-[var(--od-titlebar-h)] shrink-0" />
							<div className="min-h-0 flex-1">
								<SettingsNav section={route.section} />
							</div>
						</>
					) : (
						<ListPane selectedId={dotId} />
					)}
					<ListWidthHandle />
				</aside>
			)}
			<main className="relative flex min-w-0 flex-1 flex-col bg-chat">
				<MainPane route={route} />
			</main>
			<AnimatePresence initial={false}>
				{showDrawer && dotId && <RightDrawer key="drawer" dotId={dotId as DotId} overlay={overlay} />}
			</AnimatePresence>
			<NewDotDialog />
		</div>
	);
}
