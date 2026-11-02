import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("c1");
await page.goto(`${BASE}/projects/${P}/reports/${per[1]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button",{name:"Sheet",exact:true}).click();
const row = page.locator("tr",{hasText:"KE-OP1.1"}).first();
await row.locator("td").nth(5).click(); await page.keyboard.type("4"); await page.keyboard.press("Tab"); await page.keyboard.type("7"); await page.keyboard.press("Enter");
await page.waitForTimeout(6000);
const t=await page.locator("main").innerText(); console.log(t.replace(/\n+/g," | ").match(/Zoom in.{0,900}/)?.[0]); await page.screenshot({path:"dbg.png"});
await browser.close(); process.exit(0);
