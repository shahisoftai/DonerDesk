import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${process.argv[2]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "More actions" }).click(); await page.waitForTimeout(800);
console.log((await page.locator('[role=menu]').allInnerTexts()).join("\n---\n")); 
await browser.close(); process.exit(0);
