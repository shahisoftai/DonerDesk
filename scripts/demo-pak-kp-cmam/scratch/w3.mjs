import { attach, BASE } from "../lib.mjs";
const { page, browser } = await attach("w3");
await page.goto(BASE + "/settings/storage"); await page.waitForTimeout(3000);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0,1200));
await browser.close();
