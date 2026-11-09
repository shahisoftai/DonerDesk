import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("f5");
page.setDefaultTimeout(6000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map(s=>(s.getAttribute("aria-label")||s.name||s.id)+" => "+[...s.options].slice(0,4).map(o=>o.textContent.trim().slice(0,30)).join("/"))));
const fc = page.locator("main").getByText("fchv.csv").first(); await fc.scrollIntoViewIfNeeded();
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
