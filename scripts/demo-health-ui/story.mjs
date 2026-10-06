import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const m = Number(process.argv[2]);
const S = JSON.parse(readFileSync("story.json","utf8"))[m]; const { page, browser } = await attach();
const id = process.argv[3] ?? per[m];
await page.goto(`${BASE}/projects/${P}/reports/${id}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const tas = page.locator("textarea"); const n = await tas.count();
for (let i = 0; i < Math.min(5, n); i++) await tas.nth(i).fill(S[i]);
await page.waitForTimeout(4000); const t = await page.locator("main").innerText(); console.log("story", m + 1, t.split("\n").filter(l=>/saved|answered|Saving/i.test(l)).join(" | "));
await browser.close(); process.exit(0);
