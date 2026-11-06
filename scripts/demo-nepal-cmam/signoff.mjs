import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("signoff");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
for (const name of [/^Submit for review/, /^Approve report/]) {
  const b = page.getByRole("button", { name }); if (!(await b.count())) { console.log("no", String(name)); continue; }
  await b.first().click(); await page.waitForTimeout(2500);
  const dlg = page.locator("[role=dialog]"); if (await dlg.count()) { console.log("DIALOG:", (await dlg.first().innerText()).replace(/\n+/g," | ").slice(0,600)); const ta = dlg.first().locator("textarea"); if (await ta.count()) await ta.first().fill("Reviewed against the verified data and evidence; approved."); const c = dlg.first().getByRole("button", { name: /^(Confirm|Submit|Approve|Send)/ }); if (await c.count()) { await c.last().click(); await page.waitForTimeout(4500); } }
}
const t = await page.locator("body").innerText(); const i = t.indexOf("% ready"); console.log(t.slice(Math.max(0,i-30), i+120).replace(/\n+/g," | "));
console.log((await dump(page)).filter(l=>/button/.test(l) && /(Approve|Submit|Export|Request|Seal)/i.test(l)).join("\n"));
await browser.close(); process.exit(0);
