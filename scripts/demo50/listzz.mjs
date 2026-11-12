import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("listzz");
await page.goto(BASE + "/visuals", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
const rows = await page.locator("main a").evaluateAll(a=>a.map(x=>[x.innerText.replace(/\n+/g," / ").slice(0,110), x.getAttribute("href")]).filter(r=>/ZZ TEST|Flash update|WASH template|Water, sanitation/i.test(r[0])));
console.log(JSON.stringify(rows, null, 1));
await browser.close(); process.exit(0);
