// Electron entry for capture runs: installs the Google API stand-in, then starts the real (ESM) app main.
"use strict";
const { join } = require("node:path");
require(join(__dirname, "../seed/mock-google.cjs"));
import(join(process.env.OPENDOT_APP_DIR, "out/main/index.js")).catch((e) => {
	console.error("failed to start OpenDot", e);
	process.exit(1);
});
