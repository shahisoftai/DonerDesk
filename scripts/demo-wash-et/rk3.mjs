import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rk3"); page.setDefaultTimeout(10000);
const info = await page.evaluate(() => [...document.querySelectorAll("main select")].map((s,i)=>{ let r=s; for(let k=0;k<6&&r.parentElement;k++){r=r.parentElement; if(r.querySelector("input,textarea")&&r.innerText.includes("Remove")) break;} return {i, v:s.selectedOptions[0]?.text, n:s.options.length, t:(r.querySelector("input,textarea")?.value||"").slice(0,60)};}));
const sel = page.locator("main select");
for (const x of info) { if (x.n !== 4 || !/choose/.test(x.v)) continue; const t = x.t.toLowerCase(); const lab = /insecurity|conflict|cholera|outbreak/.test(t) ? "High" : /assum/.test(t) || /continue|contribute/.test(t) ? "Low" : "Medium"; await sel.nth(x.i).selectOption({ label: lab }); await page.waitForTimeout(1200); console.log(x.i, lab, x.t); }
await page.getByRole("button", { name: /^Confirm all/ }).first().click().catch(()=>{}); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)[\s\S]{0,200}/)?.[0]);
await browser.close(); process.exit(0);
