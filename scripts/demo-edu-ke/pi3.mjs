import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pi3");
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map(s=>(s.getAttribute("aria-label")||s.id||"")+"="+s.selectedOptions[0]?.text.slice(0,40)+" ("+s.options.length+")")));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()+(b.disabled?"[x]":"")).filter(x=>/Save|Suggest/.test(x))));
await browser.close(); process.exit(0);
