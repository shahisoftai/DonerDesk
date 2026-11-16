import { attach } from "../lib.mjs";
const { page, browser } = await attach("fmchk2");
await page.getByText("Edit the questions").first().click(); await page.waitForTimeout(1500);
const v = await page.locator("main").evaluate(() => [...document.querySelectorAll("main select")].map(s => s.options[s.selectedIndex]?.text.slice(0, 45)));
console.log(v.length, v.slice(-24).join(" | "));
await browser.close();
