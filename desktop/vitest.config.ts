import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer/src") } },
	test: {
		passWithNoTests: true,
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/unit/**/*.test.ts"],
		environment: "node",
		testTimeout: 20000,
	},
});
