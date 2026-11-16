import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("confirm");
page.setDefaultTimeout(30000);
for (const n of process.argv.slice(2)) {
  await page.getByRole("button", { name: new RegExp("^" + n + "\\. ") }).first().click(); await page.waitForTimeout(1500);
  const b = page.getByRole("button", { name: /Confirm all \d+/ }).first();
  if (await b.count()) { console.log(n, await b.innerText()); await b.click(); await page.waitForTimeout(6000); }
  const t = await page.locator("main").innerText(); console.log(n, "after:", t.slice(t.indexOf("Still to answer")).split("\n").filter(l=>/^(RESULTS|INDICATORS|PLACES|WORK)/.test(l)).length, "remaining lines");
}
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).slice(0,1200));
await shot("confirm"); await browser.close();
