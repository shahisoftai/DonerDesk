import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Report checks/ }).first().click(); await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Review and fix" }).first().click(); await page.waitForTimeout(2500);
const t = await page.locator("body").innerText(); console.log(t.slice(t.lastIndexOf("Section ")).slice(0, 2500));
await browser.close(); process.exit(0);
