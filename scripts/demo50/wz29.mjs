import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz29");
await page.getByRole("button", { name: /^6\. / }).click(); await page.waitForTimeout(2500);
const en = page.getByLabel("Ends", { exact: true }); for (let i=0;i<await en.count();i++) if (!(await en.nth(i).inputValue())) { await en.nth(i).fill("2027-04-30"); await en.nth(i).press("Tab"); }
const pw = page.locator("main label").filter({ hasText: "Project-wide" });
for (let i = 1; i < await pw.count(); i++) { await pw.nth(i).click(); await page.waitForTimeout(500); }
await page.waitForTimeout(3000);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,400));
await browser.close(); process.exit(0);
