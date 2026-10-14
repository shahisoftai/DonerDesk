import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("sugg");
await page.goto(`${BASE}/projects/${P}/evidence`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Suggest more links" }).first().click(); await page.waitForTimeout(6000);
const r = page.locator("tbody tr").first(); console.log((await r.innerText()).replace(/\n+/g," | ").slice(0, 900));
await page.screenshot({ path: "shot-sugg.png" });
await browser.close(); process.exit(0);
