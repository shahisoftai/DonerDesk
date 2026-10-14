import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach("scan");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.locator('button[aria-label="More actions"]').first().click(); await page.waitForTimeout(500);
await page.getByText("Scan for missing items").first().click(); await page.waitForTimeout(15000);
const t = await page.locator("body").innerText(); const i = t.indexOf("Scan"); console.log(t.slice(Math.max(0,i-100), i+1200).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
