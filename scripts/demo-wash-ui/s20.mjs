import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n")[5]; const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${F}/inputs?tab=finance`); await page.waitForLoadState("networkidle");
const L = [["Water point rehabilitation and disinfection", 150000, 144000], ["Latrines and school WASH blocks", 170000, 163200], ["Hygiene promotion and materials", 45000, 43200], ["Water user committees and training", 35000, 33600], ["Programme management and MEAL", 80000, 76800]];
for (let i = 1; i < L.length; i++) await page.getByRole("button", { name: "+ Add budget line" }).click();
for (const [i, [n, b, s]] of L.entries()) {
  await page.getByLabel(`Budget line ${i + 1}`, { exact: true }).fill(n); await page.getByLabel(`Budget ${i + 1}`, { exact: true }).fill(String(b));
  await page.getByLabel(`Expenditure ${i + 1}`, { exact: true }).fill(String(s)); await page.getByLabel(`Committed ${i + 1}`, { exact: true }).fill("0");
}
await page.getByLabel("Source note (optional)").fill("Final expenditure per project ledger and bank reconciliation at 31 August 2026.");
await page.getByRole("button", { name: "Save figures" }).click(); await page.waitForTimeout(3000);
console.log((await dump(page)).filter(l => /button/.test(l) && !/^a /.test(l)).map(l => l.split("|")[4]).join(", "));
console.log((await page.locator("main").innerText()).slice(500, 2200));
await page.screenshot({ path: "fin.png" });
await browser.close(); process.exit(0);
