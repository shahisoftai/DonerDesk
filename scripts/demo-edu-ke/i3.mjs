import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("i3");
const cards = await page.evaluate(() => [...document.querySelectorAll("main input")].map(e=>e.type+":"+e.value));
const sec = await page.locator("main").innerText();
console.log(sec.match(/Indicator[^\n]*missing[^\n]*/g));
const i = sec.indexOf("OP1-1a"); console.log(sec.slice(i, i+420));
await browser.close(); process.exit(0);
