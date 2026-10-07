import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { story } from "./plan7.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const m = Number(process.argv[2]);
const S = story(m); const { page, browser } = await attach("story");
await page.goto(`${BASE}/projects/${P}/reports/${process.argv[3] ?? per[m]}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const tas = page.locator("main textarea"); const n = await tas.count();
for (let i = 0; i < Math.min(S.length, n); i++) { await tas.nth(i).fill(S[i]); await tas.nth(i).blur(); await page.waitForTimeout(i === 5 ? 3500 : 700); }
await page.waitForTimeout(4500); const t = await page.locator("main").innerText(); console.log("story", m + 1, n, "fields |", t.split("\n").filter(l=>/saved|answered|Saving|to do/i.test(l)).join(" | "));
await browser.close(); process.exit(0);
