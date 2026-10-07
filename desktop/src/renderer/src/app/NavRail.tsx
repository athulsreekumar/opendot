import { cn } from "@/design-system/cn";
import { Badge, IconButton } from "@/design-system/components";
import {
	IconActivity,
	IconApprove,
	IconChats,
	IconConnections,
	IconLinks,
	IconOrganisation,
	IconSettings,
} from "@/design-system/icons";
import { useApprovals } from "@/stores/approvals";
import { useDots } from "@/stores/dots";
import { totalAttention, useOrganisation } from "@/stores/organisation";
import { navigate, type Route } from "./router";

export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			className={className}
			role="img"
			aria-label="OpenDot"
		>
			<rect width="24" height="24" rx="5.28" className="fill-accent" />
			<circle cx="6.8" cy="14" r="2" className="fill-accent-fg" />
			<circle cx="12" cy="9.6" r="2" className="fill-accent-fg" />
			<circle cx="17.2" cy="14" r="2" className="fill-accent-fg" />
		</svg>
	);
}

interface NavItemProps {
	label: string;
	active: boolean;
	icon: React.ReactNode;
	onClick: () => void;
	badge?: number;
}

function NavItem({ label, active, icon, onClick, badge }: NavItemProps) {
	return (
		<div className="od-no-drag relative flex h-10 w-full items-center justify-center">
			<span
				aria-hidden
				className={cn(
					"absolute left-0 top-2 h-6 w-[3px] rounded-r-full bg-accent transition-opacity",
					active ? "opacity-100" : "opacity-0",
				)}
			/>
			<IconButton
				size="lg"
				label={label}
				aria-current={active ? "page" : undefined}
				onClick={onClick}
				icon={icon}
				className={cn(active ? "bg-accent-subtle text-accent hover:bg-accent-subtle" : "text-fg-2 hover:text-fg")}
			/>
			{badge ? (
				<Badge variant="unread" count={badge} className="pointer-events-none absolute right-2 top-0 h-4 min-w-4 px-1" />
			) : null}
		</div>
	);
}

export function NavRail({ route }: { route: Route }) {
	const pending = useApprovals((s) => s.pending.length);
	const unread = useDots((s) => s.dots.reduce((n, d) => (d.archived || d.muted ? n : n + d.unreadCount), 0));

	const orgAttention = useOrganisation((s) => totalAttention(s.projects));

	return (
		<nav
			aria-label="Main"
			className="od-drag flex h-full w-16 shrink-0 flex-col items-center border-r border-border-subtle bg-rail pb-3 pt-[calc(var(--od-titlebar-h)+12px)]"
		>
			<BrandMark size={24} />
			<div className="mt-6 flex w-full flex-col gap-1">
				<NavItem
					label="Chats"
					active={route.name === "chats"}
					icon={<IconChats size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/chats")}
					badge={unread}
				/>
				<NavItem
					label="Dot Links"
					active={route.name === "links"}
					icon={<IconLinks size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/links")}
				/>
				<NavItem
					label="Activity"
					active={route.name === "activity"}
					icon={<IconActivity size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/activity")}
				/>
				<NavItem
					label="Connections"
					active={route.name === "connections"}
					icon={<IconConnections size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/connections")}
				/>
				<NavItem
					label="Organisation"
					active={route.name === "organisation"}
					icon={<IconOrganisation size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/organisation")}
					badge={orgAttention}
				/>
			</div>
			<div className="flex-1" />
			<div className="flex w-full flex-col gap-1">
				<NavItem
					label="Approvals"
					active={route.name === "approvals"}
					icon={<IconApprove size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/approvals")}
					badge={pending}
				/>
				<NavItem
					label="Settings"
					active={route.name === "settings"}
					icon={<IconSettings size={20} strokeWidth={1.75} />}
					onClick={() => navigate("#/settings/general")}
				/>
			</div>
		</nav>
	);
}
