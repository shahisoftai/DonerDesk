import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/templates`); await page.waitForLoadState("networkidle");
const hrefs = await page.locator(`a[href*="/templates/"]`).evaluateAll(a=>a.map(x=>[x.closest("div")?.textContent ?? "",x.getAttribute("href")]));
console.log(hrefs.filter(x=>/templates\/[0-9a-f-]{36}$/.test(x[1]) && /Completion/.test(x[0]))[0]?.[1].split("/").pop());
await browser.close(); process.exit(0);
