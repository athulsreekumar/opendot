// Renders build/icon.png (1024), the macOS menu-bar template icons and the coloured Windows tray icon from SVG using Playwright's Chromium.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(svg, size, out) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`,
	);
	await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await render(readFileSync("build/icon.svg", "utf8"), 1024, "build/icon.png");
const tray = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="3.5" cy="9.5" r="2" fill="#000"/><circle cx="8" cy="7" r="2" fill="#000"/><circle cx="12.5" cy="9.5" r="2" fill="#000"/></svg>`;
await render(tray, 16, "build/trayTemplate.png");
await render(tray, 32, "build/trayTemplate@2x.png");
// Windows (and Linux) tray: a normal coloured icon, not a template image.
await render(readFileSync("build/icon.svg", "utf8"), 32, "build/tray.png");
await browser.close();
console.log("icons rendered");
