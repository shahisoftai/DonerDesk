import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/logframe/import`); await page.waitForLoadState("networkidle");
await page.locator("input[type=file]").setInputFiles(resolve("logframe.csv")); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Import logframe from Excel")[1].slice(0,2500)); console.log((await dump(page)).filter(l=>!/^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
