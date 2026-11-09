import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ci");
console.log(await page.evaluate(() => { const i=[...document.querySelectorAll("main input:not([type=checkbox])")].find(x=>x.value.startsWith("Assistive")); let r=i; for(let k=0;k<12&&r.parentElement;k++){r=r.parentElement; if(r.querySelectorAll("input[type=checkbox]").length>12) break;}
 return JSON.stringify({inputs:[...r.querySelectorAll("input:not([type=checkbox])")].map(x=>x.type+"="+x.value), selects:[...r.querySelectorAll("select")].map(s=>[...s.options].length+":"+s.selectedOptions[0]?.text), text:r.innerText.split("\n").filter(Boolean).slice(0,14)});}));
await browser.close(); process.exit(0);
