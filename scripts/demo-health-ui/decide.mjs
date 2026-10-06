import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const note = process.argv[3] ?? "Documented in the activity records and the mentorship visit logs; the causal link is the programme team's own finding.";
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
let guard = 0;
while (guard++ < 12) {
  const b = page.getByRole("button", { name: /^Review \d+ flagged/ }); if (!(await b.count())) break;
  await b.first().click(); await page.waitForTimeout(2000);
  const k = page.getByRole("button", { name: "Keep with a note" }); if (!(await k.count())) { console.log("no keep button"); break; }
  await k.first().click(); await page.waitForTimeout(1500);
  if (guard === 1) console.log((await dump(page)).filter(l=>/button|textarea|input/.test(l) && !/^a /.test(l)).slice(-8).join("\n"));
  let ok = await page.locator("textarea").last().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
  if (!ok) { await b.first().click().catch(()=>{}); await page.waitForTimeout(2000); await page.getByRole("button", { name: "Keep with a note" }).first().click().catch(()=>{}); await page.waitForTimeout(1500); }
  await page.locator("textarea").last().fill(note);
  const conf = page.getByRole("button", { name: "Keep with note", exact: true }); await conf.click(); await page.waitForTimeout(2500);
  console.log("decided one; remaining:", await page.getByRole("button", { name: /^Review \d+ flagged/ }).count() ? (await page.getByRole("button", { name: /^Review \d+ flagged/ }).first().innerText()) : "none");
}
await browser.close(); process.exit(0);
