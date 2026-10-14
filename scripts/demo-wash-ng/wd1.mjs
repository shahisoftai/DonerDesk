import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("wd1");
await page.goto(`${BASE}/projects/${P}/activities`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const links = await page.locator("a").evaluateAll(a => a.map(x => [x.textContent.trim(), x.getAttribute("href")]).filter(x => /August 2026/.test(x[0]) && !/corrected/.test(x[0]) && /activities\/[0-9a-f-]{36}$/.test(x[1])));
await page.goto(BASE + links[0][1]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(-900)); console.log((await dump(page)).filter(l=>/select|button/.test(l)&&!/^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
