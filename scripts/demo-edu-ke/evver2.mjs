import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evver2");
console.log(await page.evaluate(() => { const e=[...document.querySelectorAll("main *")].find(x=>/^Select all \d+ awaiting/.test(x.innerText?.trim()) && x.children.length<3); return e? e.parentElement.outerHTML.replace(/class="[^"]*"/g,"").slice(0,700):"nf"; }));
await browser.close(); process.exit(0);
