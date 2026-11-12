import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz21");
await page.getByRole("button", { name: /^5\. / }).click(); await page.waitForTimeout(2000);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("5 / 10"); console.log(t.slice(i, i+900));
console.log(await page.locator("main input:visible, main select:visible").evaluateAll(s=>s.map(x=>[x.tagName,x.type,(x.closest("div")?.previousElementSibling?.innerText||x.closest("label")?.innerText||"").slice(0,30),x.value, x.tagName==="SELECT"?[...x.options].slice(0,5).map(o=>o.text):""])));
await browser.close(); process.exit(0);
