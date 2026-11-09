import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evup"); page.setDefaultTimeout(15000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button, main a")].map(b=>b.innerText.trim()).filter(x=>/upload/i.test(x))));
await page.getByRole("button", { name: /Upload evidence/ }).first().click().catch(()=>page.getByText("Upload evidence").first().click()); await page.waitForTimeout(2500);
console.log(await page.evaluate(() => { const d=document.querySelector("[role=dialog], [role=presentation].fixed"); return d? d.innerText.slice(0,1500):"nodialog"; }));
console.log(await page.evaluate(() => [...document.querySelectorAll("input,select,textarea")].filter(e=>e.offsetParent).map(e=>(e.getAttribute("aria-label")||e.name||e.id||"")+":"+e.type).slice(-20)));
await browser.close(); process.exit(0);
