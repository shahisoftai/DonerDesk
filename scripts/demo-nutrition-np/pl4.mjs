import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pl4");
for (const n of ["Bajura","Humla","Jumla","Kalikot","Mugu"]) {
  const box = page.locator("main input[type=checkbox]").filter({ has: page.locator("xpath=self::*") }).and(page.locator(`xpath=//input[@type="checkbox"][following-sibling::*[normalize-space()="${n}"] or ../following-sibling::*[normalize-space()="${n}"] or normalize-space(..)="${n}"]`)).first();
  console.log(n, await box.count());
  await box.scrollIntoViewIfNeeded(); await box.click(); await page.waitForTimeout(1200);
}
const sels = page.locator("main select").filter({ hasText: "not sure" });
while (await sels.count()) { await sels.nth(0).selectOption({ label: "District or locality" }); await page.waitForTimeout(1000); }
const t = await page.locator("main").innerText();
console.log(t.match(/Nothing ticked yet|Ticked[\s\S]{0,200}|\d+ areas? ticked[\s\S]{0,200}/)?.[0]);
console.log(t.match(/Still to answer \(\d+\)[\s\S]{0,260}/)?.[0]);
await browser.close(); process.exit(0);
