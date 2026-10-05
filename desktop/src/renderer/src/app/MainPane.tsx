import type { DotId } from "@shared/types";
import { Button } from "@/design-system/components";
import { IconNewDot } from "@/design-system/icons";
import { ActivityScreen } from "@/features/activity/ActivityScreen";
import { ChatView } from "@/features/chats/ChatView";
import { ConnectionsScreen } from "@/features/connections/ConnectionsScreen";
import { LinksScreen } from "@/features/links/LinksScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { useUi } from "@/stores/ui";
import { BrandMark } from "./NavRail";
import type { Route } from "./router";

function EmptyMain() {
	const setNewDotOpen = useUi((s) => s.setNewDotOpen);
	return (
		<div className="od-chat-wallpaper flex h-full flex-col">
			<div className="od-drag h-10 shrink-0" />
			<div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-16 text-center">
				<BrandMark size={72} />
				<div>
					<h2 className="text-xl font-semibold text-fg">Pick a Dot to start chatting</h2>
					<p className="mt-2 max-w-[360px] text-md text-fg-2">
						Each Dot is an assistant with its own skills and personality.
					</p>
				</div>
				<Button leadingIcon={<IconNewDot size={16} />} onClick={() => setNewDotOpen(true)}>
					New Dot
				</Button>
			</div>
		</div>
	);
}

export function MainPane({ route }: { route: Route }) {
	switch (route.name) {
		case "chats":
			return route.dotId ? <ChatView key={route.dotId} dotId={route.dotId as DotId} /> : <EmptyMain />;
		case "links":
			return <LinksScreen />;
		case "activity":
			return <ActivityScreen />;
		case "connections":
			return <ConnectionsScreen connectionId={route.connectionId} />;
		case "settings":
			return <SettingsScreen section={route.section} />;
		default:
			return null;
	}
}
