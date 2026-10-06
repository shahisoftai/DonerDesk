import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n")[5]; const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${F}`); await page.waitForLoadState("networkidle");
const D = [[/^7\s*Financial/, "Cross-reference to the budget-line table in this section, which is built from the verified finance figures; not a separate factual claim."], [/^9\s*Challenges/, "Supported by the project delivery records: every output closed on target and delays are recorded in the monthly activity records."], [/^10\s*Recommendations/, "A lesson reported by the field team in the activity records (A1.3 lessons learned); presented as staff-reported experience, not as a causal finding."]];
for (const [name, note] of D) {
  await page.getByRole("button", { name }).first().click(); await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Keep with a note" }).first().click(); await page.waitForTimeout(800);
  const ta = page.locator("textarea:visible").last(); await ta.fill(note);
  if (process.argv[2] === "peek") { console.log((await dump(page)).filter(l => /button|textarea/.test(l) && !/^a /.test(l)).slice(-8).map(l => l.split("|").slice(3,5).join("|")).join("\n")); await page.screenshot({ path: "dec.png" }); break; }
  const save = page.getByRole("button", { name: "Keep with note" }).last(); console.log("click", await save.innerText()); await save.click(); await page.waitForTimeout(2500);
}
console.log((await page.locator("body").innerText()).match(/\d+ (of \d+ )?issues?|0 flagged|Review \d+ flagged[^\n]*/g));
await browser.close(); process.exit(0);
