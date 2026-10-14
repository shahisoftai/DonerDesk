import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { story, stmt, PERIOD_OF } from "./plan8.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const p = Number(process.argv[2]);
// a period's story = answers of its last month; quarterly: months joined
const months = p === 6 ? [6] : PERIOD_OF.map((x, m) => x === p ? m : -1).filter(m => m >= 0);
const S = story(months[months.length - 1]).map((s, i) => months.length > 1 && i < 5 ? months.map(m => story(m)[i]).join(" ") : s);
const { page, browser } = await attach("story");
await page.goto(`${BASE}/projects/${P}/reports/${per[p]}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const tas = page.locator("main textarea"); const n = await tas.count();
for (let i = 0; i < n; i++) {
  const label = await tas.nth(i).evaluate(e => (e.getAttribute("aria-label") || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) || e.closest("div")?.querySelector("label")?.textContent || "").replace(/To do$|Answered$/, "").trim());
  const text = i < 5 ? S[i] : stmt(label, months); if (!text) { console.log("  no text for", JSON.stringify(label)); continue; }
  await tas.nth(i).fill(text); await tas.nth(i).blur(); await page.waitForTimeout(i < 5 ? 700 : 3500);
}
await page.waitForTimeout(4500); const t = await page.locator("main").innerText(); console.log("story", p, n, "fields |", t.split("\n").filter(l=>/saved|answered|Saving|to do/i.test(l)).join(" | "));
await browser.close(); process.exit(0);
