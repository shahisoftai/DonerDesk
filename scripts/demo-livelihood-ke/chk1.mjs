import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("c1");
for (const p of [0,1,2,3]) { await page.goto(`${BASE}/projects/${P}/reports/${per[p]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
 const t=await page.locator("main").innerText(); console.log(p, (t.match(/\bDraft\b/g)||[]).length, (t.match(/Figures still empty: \d+/)||[""])[0]); }
await browser.close(); process.exit(0);
