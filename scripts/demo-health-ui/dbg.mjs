import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
await page.getByRole("button", { name: /^Review \d+ flagged/ }).first().click(); await page.waitForTimeout(2500);
const k = page.getByRole("button", { name: "Keep with a note" }); console.log("keep buttons", await k.count());
await k.first().click(); await page.waitForTimeout(1500);
console.log((await dump(page)).filter(l=>/textarea|Keep with note|Cancel/.test(l)).join("\n")); await page.screenshot({path:"dbg.png"});
await browser.close(); process.exit(0);
