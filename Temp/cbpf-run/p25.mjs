import { attach } from "./lib.mjs";
const { page, browser, shot, step, type } = await attach("reporting");
const slide = page.locator("section[aria-roledescription='slide']");
await step("frequency quarterly", async () => { await page.getByLabel("Reports are made").selectOption("QUARTERLY"); await page.waitForTimeout(600); });
const add = page.getByLabel("Add a kind of report");
console.log("add control", await add.count());
for (const label of ["Quarterly report", "Final report"]) await step("add " + label, async () => {
  const sel = slide.locator("select").filter({ has: page.locator("option", { hasText: "Situation report" }) }).first();
  await sel.selectOption({ label }); await page.waitForTimeout(400);
  const btn = slide.getByRole("button", { name: /Add a kind of report|^Add$/ }); if (await btn.count()) await btn.first().click();
  await page.waitForTimeout(900);
});
console.log((await slide.innerText()).replace(/\n+/g," | ").slice(0,1800));
await shot("reporting-added");
await browser.close();
