import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const titles = process.argv[3].split("|"); const instr = process.argv[4] ?? ""; const { page, browser } = await attach();
for (const title of titles) {
  await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
  const h = page.getByRole("heading", { name: new RegExp("^[\\d.]+ " + title) }).first(); await h.scrollIntoViewIfNeeded(); await h.click(); await page.waitForTimeout(800);
  const rb = page.getByRole("button", { name: "Regenerate", exact: true }); await rb.first().click(); await page.waitForTimeout(1000);
  if (instr) await page.getByRole("textbox", { name: /^Regenerate/ }).fill(instr);
  await rb.last().click(); const t0 = Date.now(); await page.waitForTimeout(8000);
  while (Date.now() - t0 < 150000) { const t = await page.locator("body").innerText(); if (!/Being written|being written|Regenerating|Writing…|Writing\.\.\./i.test(t)) break; await page.waitForTimeout(4000); }
  await page.waitForTimeout(8000); console.log("regenerated", title, Math.round((Date.now() - t0) / 1000) + "s");
}
await browser.close(); process.exit(0);
