import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("imp3");
page.setDefaultTimeout(60000);
console.log("textarea", await page.locator("textarea").count(), (await page.locator("textarea").first().inputValue()).slice(0, 200));
await page.getByRole("button", { name: "Create planned activities" }).click(); await page.waitForTimeout(8000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Or paste"); console.log(t.slice(i, i + 1500)); console.log(page.url());
await shot("imp3"); await browser.close();
