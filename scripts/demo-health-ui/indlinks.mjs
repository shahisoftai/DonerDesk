import { attach, BASE } from "./lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle");
const links = await page.locator('table a[href*="/indicators/"]').evaluateAll(a => a.map(x => [x.textContent.trim(), x.getAttribute("href")]));
writeFileSync("indlinks.json", JSON.stringify(links)); console.log(links.length, links[0]);
await page.goto(BASE + links[0][1]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
console.log((await page.locator("main").innerText()).split("Settings")[1].slice(0,3500));
const {dump} = await import("./lib.mjs"); console.log((await dump(page)).filter(l=>!/^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
