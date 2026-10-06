import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid-superseded.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/settings`); await page.waitForLoadState("networkidle");
await page.getByLabel("Project title").fill("[DEMO-5-SUPERSEDED] Turkana MNCH Strengthening Activity (auto-created final month)");
await page.getByRole("button", { name: "Save changes" }).click(); await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Archive project" }).click(); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).slice(-600));
const c = page.getByRole("button", { name: /confirm|archive/i }); console.log(await c.allInnerTexts());
await browser.close(); process.exit(0);
