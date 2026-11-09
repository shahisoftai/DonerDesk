import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pc");
console.log(await page.evaluate(() => { const out=[]; document.querySelectorAll("main button").forEach(b=>{}); 
 const cards=[...document.querySelectorAll("main input[type=checkbox]")].reduce((m,cb)=>{ let r=cb; for(let k=0;k<8&&r.parentElement;k++){r=r.parentElement; if(r.querySelectorAll("input[type=checkbox]").length>5) break;} if(!m.includes(r)) m.push(r); return m;},[]);
 return cards.map(r=>({t:r.innerText.split("\n")[0].slice(0,50), on:[...r.querySelectorAll("input[type=checkbox]")].filter(c=>c.checked).map(c=>c.closest("label")?.innerText.trim().slice(0,12))}));}));
await browser.close(); process.exit(0);
