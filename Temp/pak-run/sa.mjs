import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("sa");
await page.goto("https://sa.donordesk.online"); await page.waitForTimeout(3000);
console.log(page.url()); console.log((await page.locator("body").innerText()).slice(0,800)); await shot("sa");
await browser.close();
