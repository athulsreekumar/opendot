import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "test/e2e",
	timeout: 90_000,
	retries: 0,
	workers: 1,
	use: { screenshot: "only-on-failure", trace: "retain-on-failure" },
	outputDir: "test-results",
});
