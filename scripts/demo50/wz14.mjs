import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz14");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
console.log(await tabs(page)); console.log(await todo(page));
const tg = page.getByLabel("Target", { exact: true }); const vals=[]; for (let i=0;i<await tg.count();i++) vals.push(await tg.nth(i).inputValue()); console.log("targets:", vals.join(","));
console.log("add disabled:", await page.getByRole("button", { name: "Add an indicator" }).isDisabled());
await browser.close(); process.exit(0);
