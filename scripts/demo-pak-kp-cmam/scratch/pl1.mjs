import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("pl1");
await page.goto(`${BASE}/where-we-work/manage`); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); console.log(t.slice(0, 3500));
console.log(await page.locator("input[type=file]").count());
await shot("manage"); await browser.close();
