import { open, shot } from "./wz.mjs";
const { page, browser } = await open("wz39");
await page.getByRole("button", { name: /^10\. / }).click(); await page.waitForTimeout(2500);
await page.getByText("What was created").first().scrollIntoViewIfNeeded().catch(()=>{});
const t = await page.evaluate(()=>{ const el=[...document.querySelectorAll("*")].find(e=>e.children.length<8 && /What was created/.test(e.innerText||"") && e.innerText.length<4000); return el?.innerText?.replace(/\n+/g," / ") });
console.log(t); await shot(page,"wz39");
await browser.close(); process.exit(0);
