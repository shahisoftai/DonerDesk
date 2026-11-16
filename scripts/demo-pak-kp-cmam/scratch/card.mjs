import { attach } from "../lib.mjs";
const { page, browser } = await attach("card");
await page.getByRole("button", { name: /^4\. / }).first().click(); await page.waitForTimeout(1500);
const n = await page.locator("main select").count(); console.log("selects", n);
const r = await page.locator("main").evaluate(() => { const out=[]; document.querySelectorAll("main select, main input:not([type=file])").forEach((e,i)=>{ if(i<24) out.push([e.tagName, e.getAttribute("aria-label")||e.id||e.name, e.type, e.value, e.disabled]); }); return out; });
console.log(JSON.stringify(r)); 
const first = await page.locator("main label").evaluateAll(els=>els.slice(0,12).map(e=>[e.innerText.slice(0,30), e.getAttribute("for")]));
console.log(JSON.stringify(first));
await browser.close();
