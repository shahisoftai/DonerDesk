import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
const links = JSON.parse(readFileSync("indlinks.json","utf8"));
for (const [name, href] of links) {
  await page.goto(BASE + href); await page.waitForLoadState("networkidle");
  const code = await page.getByLabel("Code", {exact:true}).inputValue();
  const bd = await page.getByLabel("Record a breakdown by sex, age group and disability").isChecked();
  const rate = /^Percentage/.test(name);
  await page.getByLabel("Calculation").selectOption({ label: rate ? "Reported directly (latest value)" : "Sum of period values" });
  await page.getByLabel("Direction of progress").selectOption({ label: "Higher is better" });
  await page.getByLabel("Reporting basis").selectOption({ label: "This period’s value" });
  await page.getByRole("button", { name: "Save calculation" }).click(); await page.waitForTimeout(1800);
  const t = await page.locator("main").innerText();
  console.log(code, "breakdown:", bd, "|", t.split("\n").filter(l => /^(Counts|Rate|Calculation (confirmed|needs)|.*evaluated)/i.test(l)).slice(0,3).join(" | "));
}
await browser.close(); process.exit(0);
