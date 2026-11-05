import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("scroll");
const [out, y] = process.argv.slice(2);
await page.evaluate((y) => window.scrollTo(0, Number(y)), y); await page.waitForTimeout(600);
await page.screenshot({ path: out }); await browser.close(); process.exit(0);
