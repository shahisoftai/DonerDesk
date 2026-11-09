import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("l15");
const i = page.locator("main input:not([type=checkbox])").filter({ hasText: "" }).evaluateAll(()=>0);
const idx = await page.evaluate(() => { const xs=[...document.querySelectorAll("main select")]; return xs.map((s,k)=>({k,v:s.selectedOptions[0]?.text,o:[...s.options].map(o=>o.text)})).filter(x=>x.o.length===6 && /choose/.test(x.v)).map(x=>({k:x.k,o:x.o})); });
console.log(JSON.stringify(idx).slice(0,500));
for (const x of idx) { const l = x.o.find(o=>o.includes("Wanjiru")); await page.locator("main select").nth(x.k).selectOption({label:l}); await page.waitForTimeout(1500); }
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)/)?.[0]);
await browser.close(); process.exit(0);
