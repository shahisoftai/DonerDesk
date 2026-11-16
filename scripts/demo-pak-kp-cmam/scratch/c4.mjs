import { attach } from "../lib.mjs";
const { page, browser } = await attach("c4");
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("How complete"), t.indexOf("How complete") + 250));
console.log(t.slice(t.indexOf("Still to answer")).slice(0, 700));
const r = await page.locator("main").evaluate(() => { const o=[]; document.querySelectorAll("main label").forEach((l,i)=>{ if(l.innerText.match(/Starts|Ends|Led by|Place|Feeds/i) && o.length<14) o.push(l.innerText.slice(0,40)); }); return o; });
console.log(r);
const tt = t.indexOf("Starts"); console.log(t.slice(tt-400, tt+700));
await browser.close();
