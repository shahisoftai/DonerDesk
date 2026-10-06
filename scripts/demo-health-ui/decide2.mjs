import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])];
const note = process.argv[3]; const { page, browser } = await attach(); let done = 0;
for (let it = 0; it < 40; it++) {
  try {
    await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
    const b = page.getByRole("button", { name: /^Review \d+ flagged/ }); if (!(await b.count())) { console.log("no more flagged; decided", done); break; }
    await b.first().click(); await page.waitForTimeout(2500);
    const k = page.getByRole("button", { name: "Keep with a note" }); if (!(await k.count())) { console.log("no keep button (maybe re-check needed)"); const rc = page.getByRole("button", { name: "Re-check section" }); if (await rc.count()) { await rc.first().click(); await page.waitForTimeout(8000); } continue; }
    await k.first().click(); await page.waitForTimeout(1500);
    await page.locator("textarea").last().fill(note); await page.getByRole("button", { name: "Keep with note", exact: true }).click(); await page.waitForTimeout(2500); done++;
  } catch (e) { console.log("retry", String(e).slice(0, 80)); }
}
await browser.close(); process.exit(0);
