import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const b = page.getByRole("button", { name: /Create all \d+ periods/ }); if (await b.count()) { await b.click(); await page.waitForTimeout(9000); }
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
console.log((await page.locator("main").innerText()).split("Create reporting period")[1]?.slice(0,3000));
const hr = await page.locator('a[href*="/reports/"]').evaluateAll(a=>a.map(x=>x.getAttribute("href")));
const ids = [...new Set(hr.map(h=>h.match(/reports\/([0-9a-f-]{36})/)?.[1]).filter(Boolean))]; console.log(ids);
await browser.close(); process.exit(0);
