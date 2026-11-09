import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tk"); page.setDefaultTimeout(8000);
const q = page.getByLabel("Search areas").or(page.getByPlaceholder(/search/i)).first();
const L = ["Turkana Central","Turkana West","Turkana North","Marsabit Central","Moyale","Dadaab","Ijara","Fafi","Lagdera","Wajir East","Wajir North","Wajir South","Wajir West","Mandera East","Mandera North","Mandera South","Mandera West"];
for (const n of L) { await q.fill(n.split(" ")[0] === "Turkana" || n.startsWith("Wajir") || n.startsWith("Mandera") ? n : n); await page.waitForTimeout(1200);
  try { await page.getByLabel(n, { exact: true }).first().check(); console.log("ticked", n); } catch (e) { console.log("FAILED", n); } await page.waitForTimeout(700); }
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)/)?.[0]);
await browser.close(); process.exit(0);
