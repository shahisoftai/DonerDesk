import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bulk"); page.setDefaultTimeout(10000);
console.log(await page.evaluate(() => { const b=[...document.querySelectorAll("main button")].find(x=>x.innerText.trim()==="Preview lead"); let r=b; for(let k=0;k<4;k++) r=r.parentElement; return r.outerHTML.replace(/class="[^"]*"/g,"").replace(/style="[^"]*"/g,"").slice(0,2200); }));
await browser.close(); process.exit(0);
