import { open } from "./wz.mjs";
const { page, browser } = await open("wz30");
await page.getByRole("button", { name: /^7\. / }).click(); await page.waitForTimeout(2500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("7 / 10"); console.log(t.slice(i, i+1600));
console.log(await page.locator("main input:visible, main select:visible").evaluateAll(s=>s.slice(0,8).map(x=>[x.tagName,x.type,(x.closest("div")?.previousElementSibling?.innerText||x.closest("label")?.innerText||"").slice(0,40),x.value, x.tagName==="SELECT"?[...x.options].map(o=>o.text.slice(0,30)):""])));
await browser.close(); process.exit(0);
