import { attach } from "./lib.mjs";
const { page, browser } = await attach("s1c");
for (const n of [1,3]) { const s=page.locator("#kind-source-"+n); console.log(n, await s.evaluate(e=>[...e.options].map(o=>o.text+"="+o.value).join(" | ")), await s.evaluate(e=>e.closest("li,div")?.parentElement?.innerText?.slice(0,300))); }
console.log(await page.locator("#kind-source-1").isVisible());
await browser.close();
