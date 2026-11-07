import { attach, BASE } from "./lib.mjs";
const { page, step, shot, browser } = await attach("login");
await step("open site", async () => { await page.goto(BASE + "/login"); });
console.log(page.url(), await page.title());
console.log((await page.locator("body").innerText()).slice(0, 600));
await browser.close();
