import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("srcall");
await page.goto(`${BASE}/projects/${P}/reports/${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const items = await page.locator("nav button, aside button").evaluateAll(bs => bs.map(b => b.textContent.trim()).filter(t => /^\d(\.\d)?\s?[A-Z]|^\d+\.\d+/.test(t) || /Approved$/.test(t))); 
const heads = await page.locator("h1, h2, h3").evaluateAll(hs => hs.map(h => h.textContent.trim()).filter(t => /^\d+(\.\d+)? /.test(t)));
console.log(heads.length, "sections");
for (const h of heads) {
  const el = page.getByRole("heading", { name: h, exact: true }).first(); await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.click().catch(()=>{}); await page.waitForTimeout(700);
  await page.getByRole("tab", { name: /^Sources/ }).click().catch(()=>{}); await page.waitForTimeout(700);
  const t = await page.locator("body").innerText(); const i = t.indexOf("What the AI used"); const seg = t.slice(i, i + 3000);
  const hits = seg.match(/(safety-audit|siting|02-safety)[^|\n]*/gi); if (hits) console.log("SENSITIVE CITED in", h, hits);
}
await browser.close(); process.exit(0);
