import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dstate");
const t = await page.locator("main").innerText();
console.log(t.split("Overview")[0].slice(0,200));
console.log(t.match(/(Not set up|needs|Choose|unavailable|Not yet reported|Set up)[^\n]*/gi)?.slice(0,12));
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map(s=>(s.getAttribute("aria-label")||"")+"="+s.selectedOptions[0]?.text.slice(0,30)).slice(-14)));
await browser.close(); process.exit(0);
