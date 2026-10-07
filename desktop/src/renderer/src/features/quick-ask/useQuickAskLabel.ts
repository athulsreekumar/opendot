import { acceleratorLabel, resolveQuickAsk } from "@shared/quickask";
import { isMac } from "../../lib/platform";
import { useSettings } from "../../stores/settings";

/** The configured quick-ask shortcut as people read it ("⌥Space", "Alt+Space"), or undefined while it is turned off. */
export function useQuickAskLabel(): string | undefined {
	const settings = useSettings((s) => s.settings);
	if (!settings) return undefined;
	const q = resolveQuickAsk(settings);
	return q.enabled ? acceleratorLabel(q.shortcut, isMac ? "darwin" : "other") : undefined;
}
