// usage: node vals.mjs <month-dir> <periodId>   enters the month's values in the Form view, saves, hands in and verifies
import { attach, BASE } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const M = JSON.parse(fs.readFileSync(process.argv[2] + "/month.json", "utf8")); const periodId = process.argv[3];
const { page, browser } = await attach("vals");
await page.goto(`${BASE}/projects/40d65f44-d771-4ee6-9edf-4c34a4cab5ac/reports/${periodId}/inputs`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Form", exact: true }).click(); await page.waitForTimeout(2500);
for (const [code, v] of Object.entries(M.values)) {
  const row = page.locator("tr", { has: page.locator("td", { hasText: new RegExp("^" + code + "$") }) }).first();
  const inputs = row.locator("input"); const n = await inputs.count();
  if (n < 4) { console.log("no inputs for", code); continue; }
  await inputs.nth(0).fill(v.period); if (v.cum) await inputs.nth(1).fill(v.cum); await inputs.nth(n - 1).fill(v.src);
}
await page.waitForTimeout(800);
const click = async (name) => { const b = page.getByRole("button", { name }).first(); if (await b.isEnabled().catch(() => false)) { await b.click(); await page.waitForTimeout(6000); return true; } return false; };
console.log("save", await click("Save all"));
console.log("submit", await click(/^Submit for review/));
console.log("verify", await click(/^Verify all/));
const t = await page.locator("main").innerText(); console.log(t.split("Record indicator values")[1]?.slice(0, 260));
await browser.close(); process.exit(0);
