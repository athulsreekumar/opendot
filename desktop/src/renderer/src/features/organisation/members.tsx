import type { OrgMember } from "@shared/organisation";
import type { DotColor } from "@shared/types";
import { useMemo } from "react";
import { Avatar } from "@/design-system/components";
import { useDots } from "@/stores/dots";
import { useOrganisation } from "@/stores/organisation";

export interface MemberInfo {
	id: string;
	name: string;
	icon?: string;
	color: DotColor;
	domain?: string;
	human?: boolean;
}

const ME: MemberInfo = { id: "human", name: "Me", color: "teal", human: true };

/** Looks up display info for an assignee/reviewer id ("human" or a Dot id). */
export function useMemberLookup(): (id: string | undefined) => MemberInfo {
	const dots = useDots((s) => s.dots);
	const members = useOrganisation((s) => s.org?.members);
	return useMemo(
		() => (id) => {
			if (!id || id === "human") return ME;
			const d = dots.find((x) => x.id === id);
			const m = members?.find((x) => x.dotId === id);
			return {
				id,
				name: d?.name ?? "Team member",
				icon: d?.appearance.icon,
				color: d?.appearance.color ?? "teal",
				domain: m?.domain,
			};
		},
		[dots, members],
	);
}

export function useMembers(): OrgMember[] {
	return useOrganisation((s) => s.org?.members) ?? [];
}

export function MemberAvatar({ info, size = "xs" }: { info: MemberInfo; size?: "xs" | "sm" | "md" }) {
	return <Avatar size={size} name={info.name} icon={info.human ? "user" : info.icon} color={info.color} />;
}

export function MemberChip({ id }: { id: string | undefined }) {
	const info = useMemberLookup()(id);
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			<MemberAvatar info={info} />
			<span className="truncate text-sm text-fg">{info.name}</span>
		</span>
	);
}
