import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("tview");
await page.goto(`${BASE}/projects/${P}/templates`); await page.waitForLoadState("networkidle");
const idx = Number(process.argv[2] ?? 0);
const hrefs = await page.locator(`a[href*="/templates/"]`).evaluateAll(a=>a.map(x=>[x.textContent.trim(),x.getAttribute("href")]));
const h = hrefs.filter(x=>/templates\/[0-9a-f-]{36}$/.test(x[1]))[idx]; await page.goto(BASE + h[1]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log(page.url()); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0, +process.argv[3]||5000));
console.log((await dump(page)).filter(l=>/button/.test(l)).join("\n"));
await browser.close(); process.exit(0);
