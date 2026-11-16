import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("vz9");
await page.goto(`${BASE}/dashboards`); await page.waitForTimeout(5000); console.log(page.url());
const t = await page.locator("main").innerText(); console.log(t.slice(0, 900));
await shot("dash"); await browser.close();
