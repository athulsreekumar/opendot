import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
	testDir: "tests/e2e",
	timeout: 60_000,
	retries: process.env.CI ? 1 : 0,
	expect: { timeout: 10_000 },
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: "retain-on-failure",
		launchOptions: {
			// No GPU on CI runners: software WebGL would hog the main thread. Odi falls back to its still images.
			args: ["--disable-3d-apis", "--disable-webgl"],
			// Optional override for sandboxes whose installed Chromium revision differs from Playwright's.
			...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
		},
	},
	webServer: {
		command: `npx next start -p ${PORT}`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		env: { RESEND_MOCK: "1", SITE_URL: `http://localhost:${PORT}` },
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
		{ name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
	],
});
