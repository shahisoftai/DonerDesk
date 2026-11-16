import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("vz1");
await page.goto(`${BASE}/visuals`); await page.waitForTimeout(4500);
const t = await page.locator("main").innerText(); console.log(t.slice(0, 1800));
await shot("visuals"); await browser.close();
