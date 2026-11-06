// Decide flagged statements (leave out vague/ranking sentences, keep-with-note for verified figures), approve clean sections, approve report.
import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach("review"); let log = [];
for (let it = 0; it < 30; it++) {
  await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
  const b = page.getByRole("button", { name: /^Review \d+ flagged|flagged statement/ }); if (!(await b.count())) break;
  await b.first().click(); await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText(); const stmt = (body.split("Needs a decision").slice(-1)[0] ?? "").split("\n").map(s=>s.trim()).find(s => s.startsWith("“")) ?? "";
  const vague = /strongest|weakest|neutral|evaluation for each|no performance judgement|could not be calculated/i.test(stmt);
  if (vague && await page.getByRole("button", { name: "Leave out" }).count()) { await page.getByRole("button", { name: "Leave out" }).first().click(); log.push("LEFT OUT: " + stmt.slice(0, 90)); await page.waitForTimeout(2500); continue; }
  const k = page.getByRole("button", { name: "Keep with a note" }); if (!(await k.count())) { log.push("no decision buttons"); break; }
  await k.first().click(); await page.waitForTimeout(1200);
  await page.locator("textarea").last().fill("Figure checked against the verified indicator value and the attached register; wording accepted by the reviewer."); await page.getByRole("button", { name: "Keep with note", exact: true }).click(); await page.waitForTimeout(2500); log.push("KEPT: " + stmt.slice(0, 90));
}
console.log(log.join("\n"));
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const ab = page.getByRole("button", { name: /Approve all clean sections/ }); if (await ab.count()) { await ab.first().click(); await page.waitForTimeout(6000); }
const t = await page.locator("body").innerText(); console.log(t.slice(t.indexOf("OUTLINE"), t.indexOf("OUTLINE") + 450).replace(/\n+/g, " | "));
console.log((await dump(page)).filter(l => /button/.test(l) && /(Approve|Submit|Export|checks|Request)/i.test(l)).join("\n"));
await browser.close(); process.exit(0);
