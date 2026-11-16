import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("tm1");
await page.goto(`${BASE}/team`); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); console.log(t.slice(0, 3000));
console.log(await page.getByRole("button").allInnerTexts().then(a => a.filter(x => x.length < 40)));
await shot("team"); await browser.close();
