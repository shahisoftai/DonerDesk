import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz9");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2000);
console.log(await todo(page));
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i = t.indexOf("Still to answer"); 
console.log(t.slice(0, 0), "TODO LIST:", t.slice(i, i+1100));
console.log("indicator row fields:", await page.locator("main input:visible, main select:visible, main textarea:visible").evaluateAll(s=>s.slice(0,16).map(x=>[x.tagName, x.type, x.getAttribute("aria-label")||x.placeholder||"", (x.value||"").slice(0,20)])));
await shot(page, "wz9");
await browser.close(); process.exit(0);
