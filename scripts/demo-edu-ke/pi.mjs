import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pi"); page.setDefaultTimeout(12000);
console.log(await page.evaluate(() => { const h=[...document.querySelectorAll("h2,h3,h4,p,legend,label")].find(x=>x.innerText.trim()==="Places"); let r=h.parentElement; return r.outerHTML.replace(/class="[^"]*"/g,"").replace(/<option[^>]*>[^<]*<\/option>/g,"<o/>").slice(0,1500); }));
await browser.close(); process.exit(0);
