import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("t3");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const tas = page.locator("main textarea"); const n = await tas.count();
for (let i = 0; i < n; i++) console.log(i, JSON.stringify(await tas.nth(i).evaluate(e => (e.getAttribute("aria-label") || e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent || e.closest("div")?.querySelector("label")?.textContent || "").slice(0,90))), (await tas.nth(i).inputValue()).slice(0,50));
await browser.close(); process.exit(0);
