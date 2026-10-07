import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("periods");
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /Create all \d+ periods/ }).click(); await page.waitForTimeout(8000);
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings")[1]?.slice(0,3500));
const links = await page.locator("a").evaluateAll(a=>a.map(x=>x.textContent.trim()+" "+x.getAttribute("href")).filter(x=>/periods|reports\//.test(x))); console.log(links.slice(0,40).join("\n"));
await browser.close(); process.exit(0);
