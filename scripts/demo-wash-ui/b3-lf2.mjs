import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid3.txt", "utf8").trim(); const { page, browser } = await attach();
await page.getByRole("button", { name: "Create logframe items" }).click(); await page.waitForTimeout(5000);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(300, 1800));
// indicators
await page.goto(`${BASE}/projects/${P}/logframe/indicators/import`); await page.waitForLoadState("networkidle");
await page.locator('input[type=file]').setInputFiles(process.argv[2]); await page.waitForTimeout(4000);
await page.getByRole("button", { name: /Create indicators/ }).click(); await page.waitForTimeout(5000);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(300, 2200));
await browser.close(); process.exit(0);
