import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("regenall");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.locator('button[aria-label="More actions"]').first().click(); await page.waitForTimeout(600);
await page.getByText("Regenerate whole draft").click(); await page.waitForTimeout(2000);
const d = page.locator("[role=dialog]"); if (await d.count()) { console.log((await d.first().innerText()).replace(/\n+/g," | ").slice(0,400)); const c = d.first().getByRole("button", { name: /Regenerate|Confirm|Continue/ }); await c.last().click(); }
const t0 = Date.now(); await page.waitForTimeout(8000);
while (Date.now() - t0 < 118000) { const t = await page.locator("body").innerText(); if (!/Writing sections|Writing your report|being written|Working…/i.test(t)) { console.log("DONE", Math.round((Date.now()-t0)/1000)); break; } await page.waitForTimeout(5000); }
await browser.close(); process.exit(0);
