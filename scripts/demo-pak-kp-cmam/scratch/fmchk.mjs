import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("fmchk");
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("OTP monthly"), t.indexOf("OTP monthly") + 600));
const v = await page.locator("main").evaluate(() => [...document.querySelectorAll("main select")].map(s => s.options[s.selectedIndex]?.text.slice(0, 40)).filter(x => x && !/^Number$/.test(x)));
console.log(v);
console.log(await page.getByRole("button").allInnerTexts().then(a => a.filter(x => /publish|save|delete|close/i.test(x))));
await shot("fmchk"); await browser.close();
