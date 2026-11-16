import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w4");
await shot("state"); console.log(page.url()); console.log((await page.locator("body").innerText()).slice(0,1500));
await browser.close();
