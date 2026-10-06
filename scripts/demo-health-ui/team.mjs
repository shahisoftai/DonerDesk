import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/team`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Assign member" }).click(); await page.waitForTimeout(1200);
console.log((await page.locator("main").innerText()).split("Assign member")[1]?.slice(0,800)); console.log((await dump(page)).filter(l=>!/^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
