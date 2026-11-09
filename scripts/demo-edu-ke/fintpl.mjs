import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("fintpl"); page.setDefaultTimeout(15000);
const h = await page.evaluate(() => [...document.querySelectorAll("a,button")].filter(x=>/Download the template/.test(x.innerText)).map(x=>x.outerHTML.slice(0,300)));
console.log(h);
const href = await page.evaluate(() => document.querySelector("a[href*=template], a[download]")?.getAttribute("href"));
if (href) { const t = await page.evaluate(async (u) => (await fetch(u)).text(), href); console.log(t); }
await browser.close(); process.exit(0);
