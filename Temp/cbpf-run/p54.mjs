import { attach } from "./lib.mjs";
const { page, browser } = await attach("peek4");
const slide = page.locator("section[aria-roledescription='slide']");
for (const r of await slide.locator("li").filter({hasText:"ACTIVITY"}).all()) { const s=r.locator("select").first(); console.log(await s.evaluate(x=>JSON.stringify({value:x.value, opts:[...x.options].map(o=>o.value+"="+o.textContent.slice(0,14)+(o.disabled?"(dis)":""))}))); }
await browser.close();
