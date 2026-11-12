import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz16");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const tg = page.getByLabel(/^Target/); console.log("count", await tg.count());
for (let i = 0; i < await tg.count(); i++) { if (!(await tg.nth(i).inputValue())) { await tg.nth(i).click(); await tg.nth(i).fill("95"); await tg.nth(i).press("Tab"); await page.waitForTimeout(1500); console.log("filled", i, "->", await tg.nth(i).inputValue()); } }
await page.waitForTimeout(2000); console.log(await tabs(page)); console.log((await todo(page))?.slice(0,260));
await browser.close(); process.exit(0);
