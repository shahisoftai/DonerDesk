import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach("poll2"); const t0 = Date.now();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle");
while (Date.now() - t0 < 100000) {
  const t = await page.locator("body").innerText();
  if (!/Writing sections|Writing your report|being written/i.test(t)) { console.log("DONE after", Math.round((Date.now()-t0)/1000), "s"); break; }
  await page.waitForTimeout(5000);
}
console.log((await page.locator("body").innerText()).slice(0, 1800));
await browser.close(); process.exit(0);
