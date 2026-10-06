import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer/src") } },
	// The repo root has a postcss.config.mjs for the website; Tailwind here comes from its Vite plugin instead.
	css: { postcss: { plugins: [] } },
	test: {
		passWithNoTests: true,
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/unit/**/*.test.ts"],
		environment: "node",
		testTimeout: 20000,
	},
});
