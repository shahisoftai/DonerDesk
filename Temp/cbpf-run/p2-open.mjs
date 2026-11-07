import { attach, BASE } from "./lib.mjs";
const { page, step, browser } = await attach("open-wizard");
await step("projects list", async () => { await page.goto(BASE + "/projects"); });
console.log((await page.locator("main").innerText()).slice(0, 700));
await step("wizard", async () => { await page.goto(BASE + "/projects/new/wizard"); await page.waitForSelector("h1"); });
console.log(page.url());
console.log((await page.locator("body").innerText()).slice(0, 2500));
await browser.close();
