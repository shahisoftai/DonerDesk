import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("ins");
await page.goto(`${BASE}/projects/${P}/reports/${per[0]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings |")[1]?.slice(0,1800));
console.log(await page.locator("input,button,select").evaluateAll(e=>e.map(x=>(x.getAttribute("aria-label")||x.innerText||x.name||"").slice(0,50)).filter(Boolean).slice(0,40)));
await browser.close(); process.exit(0);
