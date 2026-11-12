import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz23");
await page.getByRole("button", { name: /^6\. / }).click(); await page.waitForTimeout(2000);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("6 / 10"); console.log(t.slice(i, i+700));
console.log(await page.locator("main input:visible, main select:visible, main textarea:visible").evaluateAll(s=>s.slice(0,14).map(x=>[x.tagName,x.type,(x.closest("div")?.previousElementSibling?.innerText||x.closest("label")?.innerText||"").slice(0,30),x.value, x.tagName==="SELECT"?[...x.options].slice(0,3).map(o=>o.text.slice(0,40)):""])));
await browser.close(); process.exit(0);
