import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("st1");
console.log(await page.evaluate(() => [...document.querySelectorAll("main input:not([type=file]), main select")].map(e => (e.getAttribute("aria-label")||e.id||e.name||e.tagName)+"="+(e.value||"").slice(0,30)+" "+(e.tagName==="SELECT"?e.options.length:""))));
await browser.close(); process.exit(0);
