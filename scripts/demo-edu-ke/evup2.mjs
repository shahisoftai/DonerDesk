import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evup2");
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("main select, main input:not([type=file]), main textarea")].filter(e=>e.offsetParent).map(e=>{ const l=e.closest("label")?.innerText.split("\n")[0] || document.querySelector(`label[for="${e.id}"]`)?.innerText || ""; return l.slice(0,50)+" => "+(e.tagName==="SELECT"?[...e.options].map(o=>o.text.slice(0,25)).slice(0,8).join(","):e.type); })), null, 0));
await browser.close(); process.exit(0);
