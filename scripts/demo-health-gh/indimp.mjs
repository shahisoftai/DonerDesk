import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("indimp");
await page.goto(`${BASE}/projects/${P}/logframe/indicators/import`); await page.waitForLoadState("networkidle");
await page.locator("input[type=file]").setInputFiles(resolve("indicators.csv")); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Settings")[1].replace(/\n+/g," | ").slice(0,1500));
await page.getByRole("button", { name: /Create indicator/ }).click(); await page.waitForTimeout(10000);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(-2500));
await browser.close(); process.exit(0);
