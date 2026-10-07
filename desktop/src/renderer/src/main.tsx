import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { isMac, isWindows } from "./lib/platform";

// The quick-ask window is transparent and rounded: no page background, vibrancy behind the surface on macOS.
if (window.location.hash.startsWith("#/quick")) {
	document.documentElement.classList.add("od-quick");
	if (isMac) document.documentElement.classList.add("od-quick-vibrancy");
}
if (isWindows) document.documentElement.dataset.platform = "win32";

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
