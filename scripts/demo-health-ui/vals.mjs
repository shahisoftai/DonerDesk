import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs"; import { IND, FEM, cum, split, val } from "./data.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const m = Number(process.argv[2]); const { page, browser } = await attach();
const NOTES = JSON.parse(readFileSync("notes.json","utf8"));
await page.goto(`${BASE}/projects/${P}/reports/${per[m]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
for (const i of IND) {
  const c = i[0], v = val(c, m); if (v == null) continue;
  await page.getByLabel(`Period achievement for ${c}`).fill(String(v));
  await page.getByLabel(`Cumulative achievement for ${c}`).fill(String(cum(c, m)));
  const note = NOTES[c]?.[m]; if (note) await page.getByLabel(`Comments for ${c}`).fill(note);
}
for (const c of Object.keys(FEM)) {
  const v = val(c, m); const row = page.locator("tr", { has: page.getByLabel(`Period achievement for ${c}`) });
  await row.getByRole("button", { name: /Breakdown/ }).click(); await page.waitForTimeout(500);
  if (m === 0 && c === "HL-1.1a") { console.log((await dump(page)).filter(l=>/button|input|select/.test(l) && !/Period|Cumulative|Comments|Data source/.test(l)).join("\n")); }
  await page.getByRole("button", { name: "+ Sex" }).first().click(); await page.waitForTimeout(300);
  const [f, ml] = split(v, FEM[c]);
  await page.getByLabel("Value for Female").fill(String(f)); await page.getByLabel("Value for Male").fill(String(ml));
  await row.getByRole("button", { name: /Hide/ }).click().catch(()=>{});
}
await page.getByRole("button", { name: "Save all" }).click(); await page.waitForTimeout(5000);
const t = await page.locator("main").innerText();
console.log("month", m + 1, t.split("\n").filter(l=>/must equal|error|failed|rejected|saved/i.test(l)).join(" | "), "| Draft rows:", (t.match(/\tDraft\t/g)||[]).length, (t.match(/Verify all \(\d+\)/)||[""])[0]);
await browser.close(); process.exit(0);
