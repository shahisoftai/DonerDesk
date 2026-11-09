// usage: node shot.mjs <path-or-url|-> <out.png> [dump]
import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("shot");
const [target, out, dump] = process.argv.slice(2);
if (target && target !== "-") await page.goto(target.startsWith("http") ? target : BASE + target, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
if (dump) console.log((await page.locator("body").innerText()).slice(0, 4000));
console.log(page.url());
await browser.close(); process.exit(0);
