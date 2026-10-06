import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/evidence`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Suggest more links" }).first().click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Evidence files in this project")[1].slice(0,1500)); console.log((await dump(page)).filter(l=>/button|checkbox/.test(l)).slice(0,20).join("\n"));
await browser.close(); process.exit(0);
