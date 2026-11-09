import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp3"); page.setDefaultTimeout(12000);
console.log(await page.evaluate(() => { const b=[...document.querySelectorAll("button")].find(x=>x.innerText.trim()==="Reopen"); let r=b.parentElement.parentElement; return r.innerText.slice(0,300)+" ||| "+[...r.querySelectorAll("textarea,input,select")].map(e=>e.getAttribute("aria-label")||e.id||e.tagName).join(","); }));
await browser.close(); process.exit(0);
