import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
	main: {
		// Keep pi and every runtime dep external: they load from node_modules at runtime
		// (pi spawns workers and reads wasm/assets relative to its own files).
		plugins: [externalizeDepsPlugin()],
		resolve: { alias: { "@shared": resolve("src/shared") } },
		build: {
			rollupOptions: {
				input: { index: resolve("src/main/index.ts") },
				output: { format: "es", entryFileNames: "[name].js" },
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		resolve: { alias: { "@shared": resolve("src/shared") } },
		build: {
			rollupOptions: {
				input: { index: resolve("src/preload/index.ts") },
				// Sandboxed preloads must be CommonJS.
				output: { format: "cjs", entryFileNames: "[name].cjs" },
			},
		},
	},
	renderer: {
		root: "src/renderer",
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer/src") },
		},
		build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
	},
});
