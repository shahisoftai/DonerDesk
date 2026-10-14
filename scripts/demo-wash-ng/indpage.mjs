import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("indpage");
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle");
const links = await page.locator("a").evaluateAll(a=>a.map(x=>x.textContent.trim().slice(0,40)+" "+x.getAttribute("href")).filter(x=>/indicator/i.test(x))); console.log(links.slice(0,6));
await page.locator("tr", { hasText: "WS-IMP1" }).first().click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); console.log(page.url());
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,2000));
console.log((await dump(page)).filter(l=>/select|input|textarea|button/.test(l)&&!/^a /.test(l)).join("\n"));
await page.screenshot({path:"shot-ind.png"});
await browser.close(); process.exit(0);
