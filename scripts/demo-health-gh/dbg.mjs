import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("dbg");
await page.goto(`${BASE}/projects/${P}/reports/${per[0]}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const tas = page.locator("main textarea"); console.log(await tas.count(), (await tas.nth(5).inputValue()).slice(0,80));
const row = page.locator("main").getByText("Cross-Cutting Issues").first(); await row.click().catch(()=>{}); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/button|textarea/.test(l)&&!/Move|Review/.test(l)).slice(-8).join("\n"));
await page.screenshot({ path: "/tmp/dd7-story.png" });
await browser.close(); process.exit(0);
