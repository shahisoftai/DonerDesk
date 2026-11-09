import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("o2");
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].slice(-7).map((s) => s.getAttribute("aria-label") + ": " + [...s.options].map((o) => o.text.slice(0, 40)).join(" ; "))));
await browser.close(); process.exit(0);
