import { attach } from "./lib.mjs";
const { page, browser } = await attach("places");
const rows = await page.locator("section[aria-roledescription='slide'] li, section[aria-roledescription='slide'] article").all();
console.log(rows.length);
for (const r of rows) { const ins = await r.locator("input").evaluateAll(i=>i.map(x=>x.value)); const sel = await r.locator("select").evaluateAll(s=>s.map(x=>x.selectedOptions[0]?.textContent)); console.log(JSON.stringify(ins), JSON.stringify(sel)); }
await browser.close();
