import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { story, PERIOD_OF } from "./plan9.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const p = Number(process.argv[2]);
const usePlan = process.env.USEPLAN === "1"; // take "From your plan" suggestions where the officer left a field empty
const months = PERIOD_OF.map((x, m) => (x === p ? m : -1)).filter((m) => m >= 0);
const S = story(months[months.length - 1]).map((s, i) => (months.length > 1 && i < 5 ? months.map((m) => story(m)[i]).join(" ") : s));
const { page, browser } = await attach("story");
await page.goto(`${BASE}/projects/${P}/reports/${per[p]}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const sugg = await page.getByText("From your plan:").allInnerTexts(); console.log("suggestions shown:", sugg.length, sugg.map((s) => s.slice(0, 90)));
if (usePlan) { for (const b of await page.getByRole("button", { name: "Use this" }).all()) { await b.click(); await page.waitForTimeout(600); } }
const tas = page.locator("main textarea"); const n = await tas.count();
for (let i = 0; i < n && i < 5; i++) {
  const cur = (await tas.nth(i).inputValue()).trim(); if (usePlan && cur) { console.log("  kept plan text in field", i); continue; }
  await tas.nth(i).fill(S[i]); await tas.nth(i).blur(); await page.waitForTimeout(800);
}
await page.waitForTimeout(4500); const t = await page.locator("main").innerText(); console.log("story", p, n, "fields |", t.split("\n").filter((l) => /saved|answered|Saving|to do/i.test(l)).join(" | "));
await browser.close(); process.exit(0);
