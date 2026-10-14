import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("t2");
await page.goto(`${BASE}/projects/${P}/setup/profile`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
const sec = page.getByLabel(/A second person must approve reports/);
console.log("loaded:", await sec.isChecked());
if (!(await sec.isChecked())) { await sec.click(); await page.waitForTimeout(500); console.log("after click:", await sec.isChecked()); await page.getByRole("button", { name: "Save profile" }).click(); await page.waitForTimeout(3500); }
await page.goto(`${BASE}/projects/${P}/setup/profile`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
console.log("reloaded:", await page.getByLabel(/A second person must approve reports/).isChecked(), "tone", await page.getByLabel("Tone").inputValue());
await browser.close(); process.exit(0);
