import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dlg");
console.log(await page.evaluate(() => { const d=document.querySelector("[role=presentation].fixed, [role=dialog]"); return d ? d.innerText.slice(0,1500) : "none"; }));
console.log(await page.evaluate(() => [...document.querySelectorAll("[role=presentation].fixed button, [role=presentation].fixed select, [role=presentation].fixed input")].map(b=>(b.getAttribute("aria-label")||b.id||"")+":"+(b.innerText||b.value||"").slice(0,30))));
await browser.close(); process.exit(0);
