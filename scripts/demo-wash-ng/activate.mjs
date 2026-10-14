import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("activate");
await page.goto(`${BASE}/projects/${P}/setup`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Mark setup complete" }).click().catch(()=>console.log("no mark-complete")); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Activate project" }).first().click(); await page.waitForTimeout(3500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,700));
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings")[1]?.slice(0,3000));
await browser.close(); process.exit(0);
