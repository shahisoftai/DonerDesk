import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz27");
await page.getByRole("button", { name: /^6\. / }).click(); await page.waitForTimeout(2500);
const st = page.getByLabel("Starts", { exact: true }); const n = await st.count(); console.log("cards", n);
for (let i = 0; i < n; i++) {
  if (!(await st.nth(i).inputValue())) await st.nth(i).fill("2026-12-01");
  const en = page.getByLabel("Ends", { exact: true }).nth(i); if (!(await en.inputValue())) await en.fill("2027-04-30");
  const lb = page.getByLabel("Led by", { exact: true }).nth(i); if (!(await lb.inputValue())) await lb.selectOption({ index: 1 });
}
const pw = page.locator("main label", { hasText: /^Project-wide/ }).locator("input[type=checkbox]");
for (let i = 0; i < await pw.count(); i++) if (!(await pw.nth(i).isChecked())) await pw.nth(i).check().catch(()=>{});
await page.waitForTimeout(3500);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,500));
await browser.close(); process.exit(0);
