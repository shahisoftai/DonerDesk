import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("i4");
const out = await page.evaluate(() => { const s=[...document.querySelectorAll("main select")]; const r=[]; for(let i=0;i<s.length;i+=5) r.push(s.slice(i,i+5).map(x=>x.selectedOptions[0]?.text.slice(0,14)).join("|")); return r; });
out.forEach((l,i)=>console.log(i,l));
const inp = await page.evaluate(()=>[...document.querySelectorAll("main input[type=text],main input[type=number],main input:not([type])")].slice(0,12).map(e=>e.value));
console.log(inp);
await browser.close(); process.exit(0);
