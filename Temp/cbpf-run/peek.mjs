import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("peek");
console.log(page.url());
await shot("peek");
console.log((await page.locator("section[aria-roledescription='slide'], main").first().innerText()).slice(0, 1800));
await browser.close();
