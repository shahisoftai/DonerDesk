import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByText(process.argv[3], { exact: false }).first().click(); await page.waitForTimeout(1500);
await page.screenshot({ path: "sec.png", fullPage: false });
const t = await page.locator("body").innerText(); console.log(t.slice(t.lastIndexOf("Section ")));
await browser.close(); process.exit(0);
