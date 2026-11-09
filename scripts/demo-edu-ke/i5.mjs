import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("i5");
const sel = page.locator("main select"); const n = Math.floor((await sel.count())/5)*5;
for (let i = 1; i < 24*5; i += 5) { const v = await sel.nth(i).evaluate(e=>e.selectedOptions[0]?.text); if (/choose/.test(v)) await sel.nth(i).selectOption({ label: "Number" }); }
await page.waitForTimeout(1000);
const b = page.getByRole("button", { name: /^Confirm all/ }); console.log(await b.allInnerTexts());
if (await b.count()) { await b.first().click(); await page.waitForTimeout(4000); }
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)[\s\S]{0,500}/)?.[0]);
await browser.close(); process.exit(0);
