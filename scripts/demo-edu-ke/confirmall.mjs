import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("confirmall"); page.setDefaultTimeout(15000);
const b = page.getByRole("button", { name: /^Confirm all/ }); console.log(await b.allInnerTexts());
if (await b.count()) { await b.first().click(); await page.waitForTimeout(4500); }
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)/)?.[0]);
await browser.close(); process.exit(0);
