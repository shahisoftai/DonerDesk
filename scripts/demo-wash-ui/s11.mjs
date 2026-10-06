import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs"; import { D, cum, NOTES, FEMALE, split } from "./data.mjs";
const P = readFileSync("pid.txt", "utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const m = Number(process.argv[2]); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${per[m]}/inputs`); await page.waitForLoadState("networkidle");
for (const c of Object.keys(D)) {
  await page.getByLabel(`Period achievement for ${c}`).fill(String(D[c][m]));
  await page.getByLabel(`Cumulative achievement for ${c}`).fill(String(cum(c, m)));
  if (NOTES[c][m]) await page.getByLabel(`Comments for ${c}`).fill(NOTES[c][m]);
}
for (const c of Object.keys(FEMALE)) {
  const row = page.locator("tr", { has: page.getByLabel(`Period achievement for ${c}`) });
  await row.getByRole("button", { name: /Breakdown/ }).click(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "+ Sex" }).first().click(); await page.waitForTimeout(300);
  const [f, ml] = split(D[c][m], FEMALE[c]);
  await page.getByLabel("Value for Female").fill(String(f)); await page.getByLabel("Value for Male").fill(String(ml));
  if (m === 0 && c === "O1") await page.screenshot({ path: "breakdown.png" });
  await row.getByRole("button", { name: /Hide/ }).click().catch(()=>{});
}
await page.getByRole("button", { name: "Save all" }).click(); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText();
console.log("month", m, t.split("\n").filter(l=>/must equal|error|failed|rejected/i.test(l)).join(" | "), "| Draft rows:", (t.match(/\tDraft\t/g)||[]).length, (t.match(/Verify all \(\d+\)/)||[""])[0]);
await browser.close(); process.exit(0);
