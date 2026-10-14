import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("recheck");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Re-check affected sections" }).click(); const t0 = Date.now();
for (let i = 0; i < 40; i++) { await page.waitForTimeout(4000); const t = await page.locator("body").innerText(); if (!/Re-checking|Checking|Working/i.test(t) ) break; }
const t = await page.locator("body").innerText(); console.log(Math.round((Date.now()-t0)/1000),"s |", t.slice(t.indexOf("Version"), t.indexOf("OUTLINE")).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
