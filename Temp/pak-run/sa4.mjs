import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("sa4");
console.log(page.url()); console.log((await page.locator("body").innerText()).slice(0,2500)); await shot("sa4");
await browser.close();
