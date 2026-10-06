import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/templates`); await page.waitForLoadState("networkidle");
const idx = Number(process.argv[2] ?? 0);
const hrefs = await page.locator(`a[href*="/templates/"]`).evaluateAll(a=>a.map(x=>[x.textContent.trim(),x.getAttribute("href")])); console.log(hrefs);
const h = hrefs.filter(x=>/templates\/[0-9a-f-]{36}$/.test(x[1]))[idx]; await page.goto(BASE + h[1]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0, 9000));
console.log((await dump(page)).filter(l=>/button/.test(l)).join("\n"));
await browser.close(); process.exit(0);
