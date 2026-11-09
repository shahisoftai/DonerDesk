import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dom");
console.log(await page.evaluate(() => { const t=[...document.querySelectorAll("main *")].find(e=>e.children.length===0&&e.textContent.trim()==="Bajura"); return t?.parentElement?.outerHTML.slice(0,600); }));
await browser.close(); process.exit(0);
