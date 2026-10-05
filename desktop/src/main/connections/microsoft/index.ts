// Microsoft 365 native tools (spec 05 §5.2), one group per enabled feature.
import type { NativeToolFactory } from "../native-types";
import { calendarTools } from "./calendar";
import { mailTools } from "./mail";
import { onedriveTools } from "./onedrive";
import { teamsTools } from "./teams";

export { fetchMicrosoftAccount, microsoftOAuthConfig } from "./config";

export const microsoftTools: NativeToolFactory = (features, deps) => [
	...(features.includes("mail") ? mailTools(deps) : []),
	...(features.includes("calendar") ? calendarTools(deps) : []),
	...(features.includes("onedrive") ? onedriveTools(deps) : []),
	...(features.includes("teams") ? teamsTools(deps) : []),
];
