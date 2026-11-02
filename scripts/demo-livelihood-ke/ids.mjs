import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("ids");
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const l = await page.locator('a[href*="/reports/"]').evaluateAll(a=>a.map(x=>[x.getAttribute("href"),x.innerText.trim().slice(0,30)]));
console.log(JSON.stringify(l.filter(x=>/reports\/[0-9a-f-]{36}/.test(x[0]))));
await browser.close(); process.exit(0);
