import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { IND, SPLIT, pval, pcum, split } from "./data.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const p = Number(process.argv[2]); const { page, browser } = await attach("vals");
const NOTE = { "0:WS-OP1.1":"", "2:WS-OP1.1":"Rig breakdown for nine days in May and Mafa road closure in April", "3:WS-OC1c":"", "4:WS-OC1c":"Floods contaminated three water points; disinfected and retested", "3:WS-OP2.4":"Distribution brought forward after the cholera alert", "5:WS-OP1.1":"Total of 16 against a target of 20: rig breakdowns, road closure and floods", "5:WS-IMP1":"End-line household survey; target of 18 percent not reached" };
await page.goto(`${BASE}/projects/${P}/reports/${per[p]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
for (const i of IND) {
  const c = i[0], v = pval(c, p); if (v == null) continue;
  await page.getByLabel(`Period achievement for ${c}`, { exact: true }).fill(String(v));
  await page.getByLabel(`Cumulative achievement for ${c}`, { exact: true }).fill(String(pcum(c, p)));
  const n = NOTE[`${p}:${c}`]; if (n) await page.getByLabel(`Comments for ${c}`, { exact: true }).fill(n);
}
for (const c of Object.keys(SPLIT)) {
  const v = pval(c, p); if (v == null) continue; const row = page.locator("tr", { has: page.getByLabel(`Period achievement for ${c}`, { exact: true }) });
  await row.getByRole("button", { name: /Breakdown/ }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "+ Sex" }).first().click(); await page.waitForTimeout(300);
  const [f, ml] = split(v, SPLIT[c]);
  await page.getByLabel("Value for Female").fill(String(f)); await page.getByLabel("Value for Male").fill(String(ml));
  await row.getByRole("button", { name: /Hide/ }).click().catch(()=>{});
}
await page.getByRole("button", { name: "Save all" }).click(); await page.waitForTimeout(5000);
const t = await page.locator("main").innerText();
console.log("period", p, t.split("\n").filter(l=>/must equal|error|failed|rejected|saved/i.test(l)).join(" | "), "| Draft rows:", (t.match(/\tDraft\t/g)||[]).length, (t.match(/Verify all \(\d+\)/)||[""])[0]);
await browser.close(); process.exit(0);
