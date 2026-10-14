import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("actform");
await page.goto(`${BASE}/projects/${P}/activities/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.locator("input[name=activityDate]").fill("2026-02-09"); await page.waitForTimeout(1000);
console.log((await page.locator("form, main").first().innerText()).replace(/\n+/g," | ").slice(0,1500));
console.log((await dump(page)).filter(l=>/select|reporting|period/i.test(l)&&!/^a /.test(l)).join("\n"));
await page.screenshot({path:"shot-act.png"});
await browser.close(); process.exit(0);
