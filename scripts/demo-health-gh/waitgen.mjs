import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])];
const { page, browser } = await attach("waitgen"); const t0 = Date.now();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Generate report" }).first().click(); await page.waitForTimeout(3000);
while (Date.now() - t0 < 900000) { const t = await page.locator("body").innerText(); if (!/Writing sections|Writing your report|being written|Working…/i.test(t)) { console.log("DONE after", Math.round((Date.now()-t0)/1000), "s"); break; } await page.waitForTimeout(6000); }
await browser.close(); process.exit(0);
