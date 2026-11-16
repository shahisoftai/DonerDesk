// Builds the consolidated collection forms from forms.json. Usage: node mkform.mjs <index|all> [--publish]
import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("mkform");
page.setDefaultTimeout(20000);
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
const forms = JSON.parse(readFileSync(new URL("../forms.json", import.meta.url)));
const which = process.argv[2] === "all" ? forms.map((_, i) => i) : [Number(process.argv[2])];
const publish = process.argv.includes("--publish");
for (const fi of which) {
  const f = forms[fi]; console.log("FORM", f.name);
  await page.goto(`${BASE}/projects/${pid}/forms/new`); await page.waitForTimeout(2500);
  await page.getByLabel("Form name", { exact: true }).fill(f.name);
  await page.getByLabel("What it is for (optional)", { exact: true }).fill(f.about);
  for (let i = 0; i < f.q.length; i++) {
    await page.getByRole("button", { name: "Add a question" }).first().click(); await page.waitForTimeout(250);
    await page.getByLabel("Question " + (i + 1), { exact: true }).fill(f.q[i][0]);
    await page.getByLabel("Answer type").nth(i).selectOption({ label: f.q[i][1] });
    if (i < 2) { await page.getByLabel("Always required").nth(i).check().catch(() => {}); }
  }
  for (let j = 0; j < f.m.length; j++) {
    await page.getByRole("button", { name: "Add an indicator" }).click(); await page.waitForTimeout(300);
    const opts = await page.getByLabel("Indicator", { exact: true }).nth(j).locator("option").allInnerTexts();
    await page.getByLabel("Indicator", { exact: true }).nth(j).selectOption({ label: opts.find(o => o.startsWith(f.m[j][0] + " ")) });
    await page.getByLabel("How", { exact: true }).nth(j).selectOption({ label: "Add up a number" }); await page.waitForTimeout(300);
    const pick = page.locator("main select").filter({ has: page.locator("option", { hasText: f.m[j][1] }) });
    await pick.last().selectOption({ label: f.m[j][1] }).catch(e => console.log("pick fail", f.m[j][1], e.message.split("\n")[0]));
    await page.getByLabel("The date that decides the period", { exact: true }).nth(j).selectOption({ label: "Reporting month end date" }).catch(e => console.log("date fail", e.message.split("\n")[0]));
  }
  await shot("form" + fi);
  await page.getByRole("button", { name: "Save the draft" }).click(); await page.waitForTimeout(4000);
  console.log(page.url());
  if (publish) { await page.getByRole("button", { name: /^Publish/ }).first().click().catch(() => console.log("no publish")); await page.waitForTimeout(3000); }
}
await browser.close();
