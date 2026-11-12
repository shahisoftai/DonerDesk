import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("listzz2");
await page.goto(BASE + "/dashboards", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
console.log("URL", new URL(page.url()).pathname);
const rows = await page.locator("a").evaluateAll(a=>a.map(x=>[x.innerText.replace(/\n+/g," / ").slice(0,90), x.getAttribute("href")]).filter(r=>/Water, sanitation/i.test(r[0])));
console.log(JSON.stringify(rows));
await browser.close(); process.exit(0);
