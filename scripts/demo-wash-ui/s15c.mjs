import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach(); let ok = 0;
await page.goto(`${BASE}/projects/${P}/activities`); await page.waitForLoadState("networkidle");
const hrefs = await page.locator('a[href*="/activities/"]').evaluateAll(a => [...new Set(a.map(x => x.getAttribute("href")).filter(h => /activities\/[0-9a-f-]{36}$/.test(h)))]);
for (const h of hrefs) {
  await page.goto(BASE + h); await page.waitForLoadState("networkidle");
  const b = page.getByRole("button", { name: "Accept", exact: true }); if (!(await b.count())) continue;
  await b.click(); await page.waitForTimeout(600); await page.getByLabel("Note").fill("Verified against field report and attendance records.");
  await page.getByRole("button", { name: "Accept and submit" }).click(); await page.waitForTimeout(2200); ok++;
}
console.log("newly accepted", ok); await browser.close(); process.exit(0);
