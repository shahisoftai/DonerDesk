import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("vz8");
await page.goto(`${BASE}/visuals/templates`); await page.waitForTimeout(3000);
const t = await page.locator("main").innerText(); console.log(/ready/i.test(t), t.slice(-600));
await browser.close();
