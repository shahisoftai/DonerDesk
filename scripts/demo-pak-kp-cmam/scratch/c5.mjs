import { attach } from "../lib.mjs";
const { page, browser } = await attach("c5");
const g=(l)=>page.getByLabel(l,{exact:true});
for (const i of [0,1,21,22]) console.log(i, await g("Starts").nth(i).inputValue(), await g("Ends").nth(i).inputValue(), await g("Led by").nth(i).inputValue());
const h = await page.locator("main").evaluate(() => { const f=[...document.querySelectorAll("main *")].find(l=>l.children.length===0 && /^Where$/.test(l.innerText)); return f? f.parentElement.outerHTML.slice(0,1500):"none"; });
console.log(h);
await browser.close();
