import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("reo2"); page.setDefaultTimeout(15000);
console.log(await page.evaluate(() => { const b=[...document.querySelectorAll("main button")].find(x=>/Send back for correction/.test(x.innerText)); let r=b.parentElement.parentElement; return r.innerText.slice(0,500)+" ||| "+[...r.querySelectorAll("select,textarea,input")].map(e=>(e.getAttribute("aria-label")||e.id||e.tagName)).join(","); }));
await browser.close(); process.exit(0);
