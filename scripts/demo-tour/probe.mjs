// Probe helper: node probe.mjs <path> prints the visible text of a page as the signed-in admin (DD_EMAIL/DD_PASS from the environment).
import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const ctx = b.contexts()[0]; const page = ctx.pages()[0] ?? await ctx.newPage();
if (/login/.test(page.url()) || process.env.LOGIN) {
  await page.goto("https://donordesk.online/login"); await page.getByLabel(/email/i).first().fill(process.env.DD_EMAIL); await page.getByLabel(/password/i).first().fill(process.env.DD_PASS);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click(); await page.waitForURL((u) => !/login/.test(u.toString()));
}
if (process.argv[2]) { await page.goto("https://donordesk.online" + process.argv[2]); await page.waitForTimeout(4000); console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0, Number(process.argv[3] || 2500))); }
await b.close();
