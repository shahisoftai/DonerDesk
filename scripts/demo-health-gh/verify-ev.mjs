import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("verify-ev");
const ids = new Set();
for (let pg = 1; pg < 12; pg++) {
  await page.goto(`${BASE}/projects/${P}/evidence?verification=UPLOADED&page=${pg}`); await page.waitForLoadState("networkidle");
  const hs = await page.locator('table a[href*="/evidence/"]').evaluateAll(a => a.map(x => x.getAttribute("href")));
  const before = ids.size; hs.forEach(h => /evidence\/[0-9a-f-]{36}$/.test(h) && ids.add(h)); if (ids.size === before || ids.size >= 20) break;
}
console.log(ids.size, "to verify"); let n = 0;
for (const h of ids) {
  await page.goto(BASE + h); await page.waitForLoadState("networkidle");
  const b = page.getByRole("button", { name: "Verify evidence" }); if (!(await b.count())) continue;
  await b.click(); await page.waitForTimeout(700);
  const c = page.getByRole("button", { name: /confirm|verify|submit/i }).filter({ hasNotText: /^Verify evidence$/ }); 
  if (n === 0) console.log((await dump(page)).filter(l=>/button|textarea|select/.test(l)).join("\n"));
  if (await c.count()) { await c.first().click(); await page.waitForTimeout(1200); }
  n++; if (process.argv[2] && n >= Number(process.argv[2])) break;
}
console.log("verified clicks", n);
await browser.close(); process.exit(0);
