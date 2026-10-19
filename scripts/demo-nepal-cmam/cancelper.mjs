import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("cancelper");
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle");
for (const label of process.argv.slice(2)) {
  const card = page.locator("li, article, section, div").filter({ hasText: `Period ${label}` }).filter({ has: page.getByRole("button", { name: "Cancel period" }) }).last();
  await card.getByRole("button", { name: "Cancel period" }).first().click(); await page.waitForTimeout(600);
  await card.getByLabel(/reason/i).fill("Mar-May is reported as one quarterly report, so this automatic monthly period is not needed.");
  await card.getByRole("button", { name: "Cancel period" }).last().click(); await page.waitForTimeout(3500);
  console.log("cancelled", label);
}
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").match(/Not started\(\d\)/)?.[0]);
await browser.close(); process.exit(0);
