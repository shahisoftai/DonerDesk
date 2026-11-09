import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("opts");
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("main select")].slice(0, 5).map((s) => [...s.options].map((o) => o.text.slice(0, 30)))), null, 0));
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].slice(0,5).map(s=>s.options[s.selectedIndex]?.text.slice(0,25))));
await browser.close(); process.exit(0);
