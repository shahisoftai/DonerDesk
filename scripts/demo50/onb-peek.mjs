import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("onb-peek");
await page.goto(BASE + process.argv[2], { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
console.log(new URL(page.url()).pathname, "|", (await page.locator("main").innerText()).replace(/\s+/g," ").slice(0,500));
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map(s=>s.name+"#"+s.id)));
await browser.close(); process.exit(0);
