import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("sector");
await page.goto(`${BASE}/projects/${P}/settings`); await page.waitForLoadState("networkidle");
await page.getByLabel("Sector").selectOption({ label: "Water, sanitation & hygiene" });
await page.getByRole("button", { name: "Save changes" }).click(); await page.waitForTimeout(2500);
await page.goto(`${BASE}/projects/${P}/settings`); await page.waitForLoadState("networkidle");
console.log("sector now:", await page.getByLabel("Sector").inputValue());
await browser.close(); process.exit(0);
