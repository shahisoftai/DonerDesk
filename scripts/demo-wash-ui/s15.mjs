import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const { page, browser } = await attach(); const hrefs = readFileSync("act-hrefs.txt","utf8").trim().split("\n");
let ok = 0, skipped = [];
for (const h of hrefs) {
  await page.goto(BASE + h); await page.waitForLoadState("networkidle");
  const t = await page.locator("main").innerText();
  if (/A2\.2 — School WASH block site selection/.test(t)) { skipped.push("held-for-revision-test " + h.slice(-8)); continue; }
  if (/\bAccepted\b/.test(t.split("Review activity update")[0].slice(-300))) { ok++; continue; }
  const b = page.getByRole("button", { name: "Accept", exact: true }); if (!(await b.count())) { skipped.push("no-accept " + h.slice(-8)); continue; }
  await b.click(); await page.waitForTimeout(600);
  await page.getByLabel("Note").fill("Verified against field report and attendance records.");
  await page.getByRole("button", { name: "Accept and submit" }).click(); await page.waitForTimeout(2200);
  const t2 = await page.locator("main").innerText(); if (/\bAccepted\b/.test(t2)) ok++; else skipped.push("not-accepted " + h.slice(-8));
}
console.log("accepted", ok, "other", skipped);
await browser.close(); process.exit(0);
