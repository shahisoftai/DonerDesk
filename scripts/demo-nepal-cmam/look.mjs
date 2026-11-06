import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("look");
const url = process.argv[2];
if (url) await page.goto(url.startsWith("http") ? url : "https://donordesk.online" + url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
console.log("URL", page.url());
console.log((await page.locator("main, body").first().innerText()).slice(0, Number(process.argv[3] ?? 2500)));
await browser.close(); process.exit(0);
