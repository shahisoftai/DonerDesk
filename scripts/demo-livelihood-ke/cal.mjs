import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("cal");
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button",{name:"Create all 2 periods"}).click(); await page.waitForTimeout(8000);
await page.reload(); await page.waitForLoadState("networkidle");
const ids=await page.locator('a[href*="/reports/"]').evaluateAll(a=>[...new Set(a.map(x=>x.getAttribute("href")).filter(h=>/reports\/[0-9a-f-]{36}/.test(h)).map(h=>h.match(/reports\/([0-9a-f-]{36})/)[1]))]);
console.log(ids.length, ids);
writeFileSync("periods-raw.txt", ids.join("\n"));
await browser.close(); process.exit(0);
