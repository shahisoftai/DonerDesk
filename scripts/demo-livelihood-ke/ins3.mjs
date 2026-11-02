import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("ins");
await page.goto(`${BASE}/projects/${P}/reports/${per[0]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByText("Number of savings and loan groups formed", {exact:false}).first().click(); await page.waitForTimeout(1200);
console.log(await page.getByText("By place").count(), await page.locator('[aria-label^="Details"]').count());
const b = await page.locator("button").evaluateAll(e=>e.map(x=>(x.getAttribute("aria-label")||x.innerText||"").trim()).filter(x=>/detail|open|expand/i.test(x)));
console.log(b.slice(0,10));
await page.screenshot({path:"sheet.png"});
await browser.close(); process.exit(0);
