import { attach, BASE } from "../lib.mjs";
const { page, browser } = await attach("vz2");
await page.goto(`${BASE}/visuals`); await page.waitForTimeout(4500);
const t = await page.locator("main").innerText(); const l = t.split("\n").filter(x => /DEMO-17|Pakistan|Upper Dir/.test(x)); console.log(l);
await browser.close();
