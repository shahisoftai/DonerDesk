import { attach, BASE } from "../lib.mjs";
const { page, step, browser } = await attach("w1");
await step("wizard", async () => { await page.goto(BASE + "/projects/new/wizard"); await page.waitForSelector("h1"); await page.waitForTimeout(2500); });
console.log(page.url());
await browser.close();
