import { open } from "./wz.mjs";
const { page, browser } = await open("wz12");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const r = await page.evaluate(() => { const el=[...document.querySelectorAll("main *")].find(e=>e.children.length===0 && e.textContent.trim()==="WASH-Q-01"); let c=el; while(c && !c.querySelector("select")) c=c.parentElement; if(!c) return "no card"; return [...c.querySelectorAll("input,select")].map(x=>[x.type, (x.closest("div")?.previousElementSibling?.innerText||x.closest("label")?.innerText||"").slice(0,20), x.value]); });
console.log(JSON.stringify(r));
await browser.close(); process.exit(0);
