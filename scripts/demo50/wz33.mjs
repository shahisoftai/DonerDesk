import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz33");
await page.getByRole("button", { name: /^9\. / }).click(); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Use USD/ }).click(); await page.waitForTimeout(2500);
console.log(await tabs(page));
await page.getByRole("button", { name: /^10\. / }).click(); await page.waitForTimeout(2500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("10 / 10"); console.log(t.slice(i, i+2600));
await browser.close(); process.exit(0);
