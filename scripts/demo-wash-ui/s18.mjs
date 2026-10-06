import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const { page, browser } = await attach(); const hrefs = readFileSync("ev-hrefs.txt","utf8").trim().split("\n");
const start = Number(process.argv[2] ?? 0), cnt = Number(process.argv[3] ?? 999); let ok = 0, bad = [];
for (const h of hrefs.slice(start, start + cnt)) {
  await page.goto(BASE + h); await page.waitForLoadState("networkidle");
  const b = page.getByRole("button", { name: "Verify evidence" }); if (!(await b.count())) { ok++; continue; }
  await b.click(); await page.waitForTimeout(1000);
  const c = page.getByRole("button", { name: /^(Verify|Confirm)/ }); if (await c.count() > 0) { await c.last().click(); await page.waitForTimeout(1800); }
  const t = await page.locator("main").innerText(); if (/\nVerified\n/.test(t)) ok++; else bad.push(h.slice(-6));
}
console.log("verified", ok, "unclear", bad);
await browser.close(); process.exit(0);
