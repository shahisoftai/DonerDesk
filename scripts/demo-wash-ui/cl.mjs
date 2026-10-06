import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
const NOTES = { "No activity updates submitted for this period": "Six activity updates were submitted and accepted for August 2026; the item was raised before they were recorded.",
 "Financial figures entered": "Final budget and expenditure entered by budget line and verified (USD 480,000 budget; USD 460,800 spent).",
 "Beneficiary data disaggregated": "Safe-water and hygiene-promotion values are recorded and verified by sex for every month; activity records carry male and female counts.",
 "AI-generated content reviewed": "All 12 sections were read, flagged statements decided with notes, and sections approved by the project manager.",
 "Sensitive data handling confirmed": "Demo data only: attendance registers use anonymised participant IDs and photos are synthetic; no personal data is held." };
const only = process.argv[2];
for (const [title, note] of Object.entries(NOTES)) {
  if (only && !title.startsWith(only)) continue;
  await page.goto(`${BASE}/projects/${P}/compliance`); await page.waitForLoadState("networkidle");
  const card = page.getByText(title, { exact: true }).first().locator("xpath=ancestor::*[.//button[normalize-space()='Resolve']][1]");
  console.log("  card contains resolve buttons:", await card.getByRole("button", { name: "Resolve", exact: true }).count());
  await card.getByRole("button", { name: "Resolve", exact: true }).click(); await page.waitForTimeout(900);
  const note_ = card.getByLabel("Note"); await note_.fill(note);
  await card.getByRole("button", { name: "Confirm", exact: true }).first().click(); await page.waitForTimeout(900);
  const c2 = card.getByRole("button", { name: "Confirm", exact: true }); if (await c2.count()) { await c2.last().click(); } await page.waitForTimeout(2500);
  await page.reload(); await page.waitForLoadState("networkidle"); const L = (await page.locator("main").innerText()).split("\n"); console.log("resolved?", title, "->", L.slice(L.indexOf(title) + 1, L.indexOf(title) + 3).join("|"));
}
await browser.close(); process.exit(0);
