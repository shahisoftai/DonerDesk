import { attach, BASE } from "../lib.mjs";
const { page, browser } = await attach("vz7");
await page.goto(`${BASE}/visuals`); await page.waitForTimeout(4500);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Your designs"), t.indexOf("Your designs") + 500));
const l = await page.locator("main a").evaluateAll(a => a.filter(x => /Nutrition: screening|Pakistan|CMAM and IYCF in Upper/.test(x.innerText)).map(x => [x.innerText.slice(0, 80).replace(/\n/g, " "), x.href]));
console.log(l);
await browser.close();
