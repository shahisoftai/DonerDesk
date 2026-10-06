import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "More actions" }).click(); await page.waitForTimeout(500);
await page.getByText("Export center").first().click(); await page.waitForTimeout(4000);
console.log(page.url()); console.log((await page.locator("body").innerText()).slice(-2500));
await browser.close(); process.exit(0);
