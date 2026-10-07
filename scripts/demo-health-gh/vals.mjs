import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { IND, SPLIT } from "./data.mjs"; import { val, cum, split } from "./plan7.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const m = Number(process.argv[2]); const { page, browser } = await attach("vals");
const NOTE = { "4:MR-OC1c":"National Penta vaccine shortage of about three weeks","4:MR-OC1e":"National Penta shortage and tracer-medicine stock-outs","7:MR-OP1.4":"Industrial action by nurses and CHOs, about two weeks; clinics suspended","7:MR-OC1d":"Industrial action reduced postnatal checks","10:MR-OP1.2":"Last equipment shipment held at customs","11:MR-IMP1":"Annual figure from the maternal death audit; target of 120 not met","2:MR-OC1a":"Holiday-season dip" };
await page.goto(`${BASE}/projects/${P}/reports/${per[m]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
for (const i of IND) {
  const c = i[0], v = val(c, m); if (v == null) continue;
  await page.getByLabel(`Period achievement for ${c}`).fill(String(v));
  await page.getByLabel(`Cumulative achievement for ${c}`).fill(String(cum(c, m)));
  const n = NOTE[`${m}:${c}`]; if (n) await page.getByLabel(`Comments for ${c}`).fill(n);
}
for (const c of Object.keys(SPLIT)) {
  const v = val(c, m); if (v == null) continue; const row = page.locator("tr", { has: page.getByLabel(`Period achievement for ${c}`) });
  await row.getByRole("button", { name: /Breakdown/ }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "+ Sex" }).first().click(); await page.waitForTimeout(300);
  const [f, ml] = split(v, SPLIT[c]);
  await page.getByLabel("Value for Female").fill(String(f)); await page.getByLabel("Value for Male").fill(String(ml));
  await row.getByRole("button", { name: /Hide/ }).click().catch(()=>{});
}
await page.getByRole("button", { name: "Save all" }).click(); await page.waitForTimeout(5000);
const t = await page.locator("main").innerText();
console.log("month", m + 1, t.split("\n").filter(l=>/must equal|error|failed|rejected|saved/i.test(l)).join(" | "), "| Draft rows:", (t.match(/\tDraft\t/g)||[]).length, (t.match(/Verify all \(\d+\)/)||[""])[0]);
await browser.close(); process.exit(0);
