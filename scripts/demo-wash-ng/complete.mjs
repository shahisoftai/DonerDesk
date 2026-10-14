import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("complete");
await page.goto(`${BASE}/projects/${P}/settings`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Mark completed" }).click(); await page.waitForTimeout(2500);
const dlg = page.locator("[role=dialog]"); if (await dlg.count()) { console.log("DIALOG:", (await dlg.first().innerText()).replace(/\n+/g," | ").slice(0,400)); await dlg.first().getByRole("button", { name: /Mark completed|Confirm|Complete/ }).last().click(); await page.waitForTimeout(3500); }
await page.goto(`${BASE}/projects/${P}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0, 1500));
await browser.close(); process.exit(0);
