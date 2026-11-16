import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("s4");
page.setDefaultTimeout(15000);
const rows = readFileSync(new URL("../inputs/indicators.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map(l => l.split(","));
const emp = { OC: "Imran Yousafzai", "1.1": "Gul Rehman", "1.2": "Gul Rehman", "1.3": "Nasreen Akhtar", "1.4": "Nasreen Akhtar", "2.1": "Farah Naz", "2.2": "Farah Naz", "2.3": "Farah Naz", "3.1": "Zahid Ali", "3.2": "Zahid Ali" };
await page.getByRole("button", { name: /^4\. / }).first().click(); await page.waitForTimeout(1500);
const resp = page.getByLabel("Responsible", { exact: true }), better = page.getByLabel("Better when", { exact: true }), nostart = page.getByLabel("No starting value", { exact: true });
console.log("cards", await resp.count());
for (let i = 0; i < rows.length; i++) {
  const [code, , type, base, , , , , lf, , bet] = rows[i];
  const who = emp[lf.startsWith("OC") ? "OC" : lf];
  const opts = await resp.nth(i).locator('option').allInnerTexts(); await resp.nth(i).selectOption({ label: opts.find(o => o.startsWith(who)) }); await page.waitForTimeout(150);
  await better.nth(i).selectOption({ label: bet }); await page.waitForTimeout(150);
  if (type === "PERCENTAGE") { if (!(await nostart.nth(i).isChecked())) { await nostart.nth(i).click(); await page.waitForTimeout(500); } }
  if (i % 10 == 9) console.log("done", i + 1);
}
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).split("\n").filter(l=>/INDIC|PLACES|Indicator|Choose|Confirm/.test(l)).slice(0,8));
await shot("s4"); await browser.close();
