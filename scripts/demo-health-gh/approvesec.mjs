import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("approvesec");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const all = page.getByRole("button", { name: /Approve all clean sections/ }); if (await all.count()) { await all.first().click(); await page.waitForTimeout(5000); }
for (let i = 0; i < 12; i++) {
  const names = await page.locator("button").evaluateAll(bs => bs.map(b => b.textContent.trim()).filter(t => /^\d+.+(Draft|Needs review|Needs a decision|Drafted)$/.test(t)));
  if (!names.length) break;
  console.log("pending:", names[0]); await page.locator("button").filter({ hasText: names[0] }).first().click(); await page.waitForTimeout(1500);
  const b = page.getByRole("button", { name: "Approve section", exact: true }); if (!(await b.count())) { console.log("  no approve button (flag?)"); break; } await b.first().click(); await page.waitForTimeout(3500);
}
const t = await page.locator("body").innerText(); console.log(t.slice(t.indexOf("OUTLINE"), t.indexOf("OUTLINE") + 40).replace(/\n+/g, " | "));
await browser.close(); process.exit(0);
