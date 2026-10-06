import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
const RANGE = ["MONTHLY (3/1/2026", "MONTHLY (4/1/2026", "MONTHLY (5/1/2026", "MONTHLY (6/1/2026", "MONTHLY (7/1/2026", "FINAL (8/1/2026"];
let n = 0, skipped = 0;
for (let p = 1; p <= 3; p++) {
  await page.goto(`${BASE}/projects/${P}/evidence?page=${p}`); await page.waitForLoadState("networkidle");
  const rows = page.locator("main tbody tr"); const cnt = await rows.count();
  for (let i = 0; i < cnt; i++) {
    const row = rows.nth(i); const t = (await row.locator("a").first().innerText()).trim(); const m = Number(t.slice(0, 2)) - 1; if (!(m >= 0 && m < 6)) { continue; }
    const sel = row.getByLabel("Reporting period"); if (!(await sel.count())) continue;
    if ((await sel.inputValue()) !== "") { skipped++; continue; }
    const opts = await sel.locator("option").allInnerTexts(); const o = opts.find(x => x.startsWith(RANGE[m])); await sel.selectOption({ label: o }); await page.waitForTimeout(1200); n++;
  }
}
console.log("linked", n, "already", skipped);
await browser.close(); process.exit(0);
