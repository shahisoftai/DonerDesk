import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n")[5];
const L = [["Personnel and fringe benefits",450000,428000],["Travel, transport and referral vouchers",95000,91200],["Equipment and commodities (MNCH kits, solar refrigerators)",230000,224500],["Training and clinical mentorship",120000,114300],["Community health activities (CHV kits, dialogues, radio)",85000,79800],["Subaward to LOCHA",70000,66000],["Indirect costs (NICRA 10 percent)",100000,98700]];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${F}/inputs?tab=finance`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
for (let i = 0; i < L.length; i++) {
  if (i > 0) { await page.getByRole("button", { name: "+ Add budget line" }).click(); await page.waitForTimeout(300); }
  await page.getByLabel(`Budget line ${i + 1}`).fill(L[i][0]); await page.getByLabel(`Budget ${i + 1}`, { exact: true }).fill(String(L[i][1])); await page.getByLabel(`Expenditure ${i + 1}`).fill(String(L[i][2]));
}
await page.getByLabel("Source note (optional)").fill("Finance ledger to 31 August 2026, reconciled to the SF-425 draft; indirect costs at the NICRA rate.");
await page.getByRole("button", { name: "Save figures" }).click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Finance")[1]?.slice(0, 900));
const v = page.getByRole("button", { name: "Verify these figures" }); if (await v.count()) { await v.click(); await page.waitForTimeout(4000); console.log((await page.locator("main").innerText()).split("Finance")[1]?.slice(0, 700)); }
await browser.close(); process.exit(0);
