import { attach, dump } from "./lib.mjs"; const { page, browser } = await attach();
console.log(page.url()); console.log((await page.locator("main").innerText()).split("Flexible inputs")[1]?.slice(0, 1500)); console.log((await dump(page)).filter(l=>/button|checkbox|textarea/.test(l) && !/^a /.test(l)).join("\n")); await page.screenshot({path:"fshot.png"});
await browser.close(); process.exit(0);
