import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs"; import { STORY } from "./story.mjs";
const P = readFileSync("pid.txt", "utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach();
for (const m of process.argv.slice(2).map(Number)) {
  await page.goto(`${BASE}/projects/${P}/reports/${per[m]}/inputs?tab=story`); await page.waitForLoadState("networkidle");
  const ta = page.locator("main textarea"); const n = await ta.count();
  for (let i = 0; i < n; i++) { await ta.nth(i).fill(STORY.filter(Boolean)[m][i]); await ta.nth(i).blur(); await page.waitForTimeout(700); }
  await page.waitForTimeout(2000); 
  const btn = page.getByRole("button", { name: /save/i }); if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(2000); }
  await page.reload(); await page.waitForLoadState("networkidle");
  console.log("month", m + 1, (await page.locator("main").innerText()).match(/\d\/5 answered/)?.[0]);
}
await browser.close(); process.exit(0);
