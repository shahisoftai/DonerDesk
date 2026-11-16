import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const inv = JSON.parse(readFileSync(new URL("../invites.json", import.meta.url)));
const PASS = process.env.DEMO_PASS || "Demo#Pak2026kp";
const b = await chromium.connectOverCDP("http://localhost:9333");
for (const [name, email, url] of inv) {
  const ctx = await b.newContext(); const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  await page.goto("https://donordesk.online" + url); await page.waitForTimeout(2500);
  await page.locator("input[name=name]").fill(name); await page.locator("input[name=password]").fill(PASS);
  await page.locator("input[name=acceptTerms]").check(); await page.getByRole("button", { name: "Accept invitation" }).click();
  await page.waitForTimeout(6000); console.log(name, "->", page.url().replace("https://donordesk.online", ""));
  await ctx.close();
}
await b.close();
