import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { FINANCE } from "./data.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n").pop();
const { page, browser } = await attach("fin");
await page.goto(`${BASE}/projects/${P}/reports/${F}/inputs?tab=finance`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
for (let i = 0; i < FINANCE.length; i++) {
  if (i > 0) { await page.getByRole("button", { name: "+ Add budget line" }).click(); await page.waitForTimeout(300); }
  await page.getByLabel(`Budget line ${i + 1}`).fill(FINANCE[i][0]); await page.getByLabel(`Budget ${i + 1}`, { exact: true }).fill(String(FINANCE[i][1])); await page.getByLabel(`Expenditure ${i + 1}`).fill(String(FINANCE[i][2]));
}
await page.getByLabel("Source note (optional)").fill("Finance ledger to 30 September 2026, reconciled to the final financial statement; indirect costs at the agreed flat rate.");
await page.getByRole("button", { name: "Save figures" }).click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Finance")[1]?.replace(/\n+/g," | ").slice(0, 700));
const v = page.getByRole("button", { name: "Verify these figures" }); if (await v.count()) { await v.click(); await page.waitForTimeout(4000); console.log((await page.locator("main").innerText()).split("Finance")[1]?.replace(/\n+/g," | ").slice(0, 600)); }
await browser.close(); process.exit(0);
