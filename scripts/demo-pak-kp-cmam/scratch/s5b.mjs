import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s5b");
await page.getByLabel("Search areas").fill("Dir"); await page.waitForTimeout(1500);
let t = await page.locator("main").innerText(); let i = t.indexOf("Search areas"); console.log(t.slice(i, i + 500));
await page.getByLabel("Search areas").fill("Mardan"); await page.waitForTimeout(1500);
t = await page.locator("main").innerText(); i = t.indexOf("Search areas"); console.log(t.slice(i, i + 400));
await shot("s5b"); await browser.close();
