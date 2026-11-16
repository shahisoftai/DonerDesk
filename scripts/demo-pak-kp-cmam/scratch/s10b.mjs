import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s10b");
page.setDefaultTimeout(15000);
const vals = await page.locator("main").evaluate(() => [...document.querySelectorAll("main select, main input[type=text], main textarea")].filter(e=>e.value && /happen|assum|decided|depend|Winter|Flood|Turnover|RUTF|Stock|Late|Nutrition|UNICEF|HIGH|MEDIUM|LOW/i.test(e.value)).map(e=>e.value.slice(0,60)));
console.log(vals);
const t = await page.locator("main").innerText(); const j = t.indexOf("What will be created"); console.log(t.slice(j, j + 900)); console.log(t.slice(t.indexOf("Sign off")).slice(0, 700));
await browser.close();
