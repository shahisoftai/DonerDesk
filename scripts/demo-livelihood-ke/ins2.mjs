import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("ins");
await page.goto(`${BASE}/projects/${P}/reports/${per[0]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button",{name:"Form",exact:true}).click(); await page.waitForTimeout(1500);
console.log(await page.locator("input,button,summary").evaluateAll(e=>e.map(x=>(x.getAttribute("aria-label")||x.innerText||"").slice(0,60)).filter(x=>/KE-OP1.1|place|Break|Hide/i.test(x))));
await page.screenshot({path:"form.png"});
await browser.close(); process.exit(0);
