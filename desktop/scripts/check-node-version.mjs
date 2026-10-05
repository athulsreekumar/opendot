// Fails install if Electron's bundled Node cannot run pi (needs >= 22.19).
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let electronPath;
try {
	electronPath = require("electron");
} catch {
	console.log("ok (electron binary not installed yet)");
	process.exit(0);
}
let v;
try {
	v = execFileSync(electronPath, ["-e", "process.stdout.write(process.versions.node)"], {
		env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
	})
		.toString()
		.trim();
} catch (e) {
	console.warn("warn: could not start electron to check its Node version:", e.message);
	process.exit(0);
}
const [maj, min] = v.split(".").map(Number);
if (maj > 22 || (maj === 22 && min >= 19)) {
	console.log("ok", v);
} else {
	console.error(`Electron bundles Node ${v}; pi needs >= 22.19`);
	process.exit(1);
}
