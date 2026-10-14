import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("withdraw");
await page.goto(`${BASE}/projects/${P}/activities`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const links = await page.locator("a").evaluateAll(a => a.map(x => [x.textContent.trim(), x.getAttribute("href")]).filter(x => /August 2026/.test(x[0]) && /activities\/[0-9a-f-]{36}$/.test(x[1])));
const olds = links.filter(l => /corrected import/.test(l[0])); console.log("old:", olds.length, "new:", links.length - olds.length);
for (const [title, href] of olds) {
  await page.goto(BASE + href); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
  const sel = page.getByLabel(/Replaced by/); const opts = await sel.locator("option").allInnerTexts();
  const o = opts.find(x => !x.includes("corrected import") && x.includes(title.slice(0, 5))); if (o) await sel.selectOption({ label: o }); else console.log("no replacement option for", title.slice(0, 40), opts.length);
  await page.getByRole("button", { name: /Withdraw/ }).first().click(); await page.waitForTimeout(2500);
  const dlg = page.locator("[role=dialog]"); if (await dlg.count()) { await dlg.first().getByRole("button", { name: /Withdraw|Confirm/ }).last().click(); await page.waitForTimeout(2500); }
  console.log("withdrew", title.slice(0, 50), "->", (await page.locator("main").innerText()).replace(/\n+/g," | ").match(/Withdrawn[^|]*|Replaced by[^|]*/)?.[0]);
}
await browser.close(); process.exit(0);
