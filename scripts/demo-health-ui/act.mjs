import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/setup`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Activate project" }).click(); await page.waitForTimeout(3000);
console.log((await page.locator("main").innerText()).slice(0,300));
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
console.log((await page.locator("main").innerText()).slice(0,1500)); console.log((await dump(page)).join("\n"));
await browser.close(); process.exit(0);
