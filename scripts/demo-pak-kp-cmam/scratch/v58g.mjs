import { attach } from "../lib.mjs";
const { page, browser } = await attach("v58g");
await page.getByRole("button", { name: /^6\. / }).first().click(); await page.waitForTimeout(2500);
const t = await page.locator("main").innerText(); console.log("has text:", /Repeats every month/.test(t), "| articles:", await page.locator("main article").count());
const f = await page.locator("main article").first().innerText(); console.log(f.slice(0, 300).replace(/\n/g, " | "));
await browser.close();
