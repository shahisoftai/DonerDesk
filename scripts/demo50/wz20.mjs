import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz20");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const h = page.getByLabel("How often", { exact: true }); const n = await h.count();
await h.nth(n - 2).selectOption({ label: "Monthly" }); await page.waitForTimeout(2500);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,600));
await browser.close(); process.exit(0);
