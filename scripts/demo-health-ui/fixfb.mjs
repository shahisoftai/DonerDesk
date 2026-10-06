import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const INSTR = "Do not calculate any figure yourself: no cumulative totals and no percentages except those given in the data. State only the recorded values and targets. Do not refer to other sections by name.";
const { page, browser } = await attach();
for (let round = 0; round < 3; round++) {
  await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
  const titles = await page.evaluate(() => [...document.querySelectorAll("h2[id^=section-heading]")].filter(h => /Written without AI/.test(h.parentElement?.innerText ?? "")).map(h => h.innerText.replace(/^\d+(\.\d+)*\s+/, "").trim()));
  console.log("round", round, "fallback sections:", titles.join(" | ") || "none"); if (!titles.length) break;
  for (const t of titles) {
    const h = page.getByRole("heading", { name: new RegExp("^[\\d.]+ " + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first(); await h.scrollIntoViewIfNeeded(); await h.click(); await page.waitForTimeout(700);
    const rb = page.getByRole("button", { name: "Regenerate", exact: true }); await rb.first().click(); await page.waitForTimeout(900);
    await page.getByRole("textbox", { name: /^Regenerate/ }).fill(INSTR); await rb.last().click(); await page.waitForTimeout(45000);
  }
}
await browser.close(); process.exit(0);
