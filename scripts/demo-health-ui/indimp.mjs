import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/logframe/indicators/import`); await page.waitForLoadState("networkidle");
await page.locator("input[type=file]").setInputFiles(resolve("indicators.csv")); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Settings")[1].slice(0,1800));
await page.getByRole("button", { name: /Create indicators/ }).click(); await page.waitForTimeout(9000);
console.log((await page.locator("main").innerText()).split("Download template")[1]?.slice(0,2500));
await browser.close(); process.exit(0);
