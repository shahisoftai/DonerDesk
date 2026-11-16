import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("pl9");
page.setDefaultTimeout(15000);
await page.getByText(/^Sites \(/).first().click(); await page.waitForTimeout(2000);
let t = await page.locator("main").innerText(); let i = t.indexOf("To confirm ("); console.log(t.slice(i, i + 1600));
await shot("pl9"); await browser.close();
