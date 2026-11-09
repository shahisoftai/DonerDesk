import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rk");
const info = await page.evaluate(() => [...document.querySelectorAll("main select")].map((s,i)=>{ const card=s.closest("div[class*=border], li, div"); let r=s; for(let k=0;k<6&&r.parentElement;k++){r=r.parentElement; if(r.querySelector("input,textarea")&&r.innerText.includes("Remove")) break;} return {i, v:s.selectedOptions[0]?.text, opts:[...s.options].length, t:(r.querySelector("input,textarea")?.value||r.innerText).slice(0,70)};}));
console.log(JSON.stringify(info,null,0));
await browser.close(); process.exit(0);
