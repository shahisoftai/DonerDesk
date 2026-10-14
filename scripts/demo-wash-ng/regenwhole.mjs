import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("regenwhole");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "More actions" }).click(); await page.waitForTimeout(600);
await page.getByText("Regenerate whole draft").first().click(); await page.waitForTimeout(2000);
const dlg = page.locator("[role=dialog]"); if (await dlg.count()) { console.log("DIALOG:", (await dlg.first().innerText()).replace(/\n+/g," | ").slice(0,500)); const ta = dlg.first().locator("textarea"); if (await ta.count() && process.argv[3]) await ta.first().fill(process.argv[3]); await dlg.first().getByRole("button", { name: /Regenerate|Confirm|Start|Yes/ }).last().click(); }
const t0 = Date.now(); await page.waitForTimeout(8000);
for (let i = 0; i < 60; i++) { const t = await page.locator("body").innerText(); if (!/Writing your report|being written|Working…/i.test(t)) break; await page.waitForTimeout(4000); }
const t = await page.locator("body").innerText(); console.log(Math.round((Date.now()-t0)/1000), "s |", t.slice(t.indexOf("Version"), t.indexOf("OUTLINE")).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
