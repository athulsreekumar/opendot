// Google Workspace native tools (spec 05 §5.1).
import type { NativeToolFactory } from "../native-types";
import { calendarTools } from "./calendar";
import { driveTools } from "./drive";
import { gmailTools } from "./gmail";

export const googleTools: NativeToolFactory = (features, deps) => [
	...(features.includes("gmail") ? gmailTools(deps) : []),
	...(features.includes("calendar") ? calendarTools(deps) : []),
	...(features.includes("drive") ? driveTools(deps) : []),
];
