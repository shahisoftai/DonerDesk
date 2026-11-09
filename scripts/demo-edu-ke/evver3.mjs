import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evver3");
console.log(await page.evaluate(() => [...document.querySelectorAll("main input[type=checkbox]")].slice(0,3).map(c=>c.outerHTML.slice(0,200)+" | "+(c.closest("label")?.innerText||"").slice(0,60)+" | "+c.parentElement.innerText.slice(0,60))));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].filter(b=>/Verify/.test(b.innerText)).map(b=>b.outerHTML.replace(/class="[^"]*"/g,"").slice(0,200))));
await browser.close(); process.exit(0);
