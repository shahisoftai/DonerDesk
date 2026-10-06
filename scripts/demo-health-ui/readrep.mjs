import { attach, BASE } from "./lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const t = await page.locator("body").innerText(); writeFileSync(`report-${process.argv[2]}.txt`, t);
console.log(t.slice(t.indexOf("OUTLINE")));
await browser.close(); process.exit(0);
