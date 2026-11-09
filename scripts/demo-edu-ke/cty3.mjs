import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cty3");
console.log(await page.evaluate(() => { const h=[...document.querySelectorAll("h2,h3")].find(x=>/Add many places/.test(x.innerText)); let r=h.parentElement; return r.outerHTML.replace(/class="[^"]*"/g,"").slice(0,1200); }));
await browser.close(); process.exit(0);
