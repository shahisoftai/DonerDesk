import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("txt");
if (process.argv[2]) await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000); await page.screenshot({ path: process.env.SHOT });
console.log(page.url()); console.log((await page.locator("body").innerText()).slice(0, Number(process.argv[3]||2500)));
await browser.close(); process.exit(0);
