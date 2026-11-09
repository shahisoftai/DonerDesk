import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("codes");
const cards = await page.evaluate(() => [...document.querySelectorAll("main span, main div")].filter(e=>/^(GI|OC|OP)[0-9a-z-]*$/i.test(e.textContent.trim()) && e.children.length===0).map(e=>e.textContent.trim()));
console.log(cards.length, cards.join(" "));
await browser.close(); process.exit(0);
