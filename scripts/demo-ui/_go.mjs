import { attach } from "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/scripts/demo-ui/lib.mjs";
const { page, browser } = await attach("go");
const [url, shot] = process.argv.slice(2);
if (url) { await page.goto("https://donordesk.online" + url, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000); }
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0, 3500));
if (shot) await page.screenshot({ path: shot, fullPage: true });
await browser.close(); process.exit(0);
