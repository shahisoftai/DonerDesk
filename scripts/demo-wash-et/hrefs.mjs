import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("hrefs");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
console.log((await page.evaluate(() => [...document.querySelectorAll("main a")].map((a) => a.innerText.trim() + " -> " + a.getAttribute("href")).filter((x) => /projects\/40d65f44/.test(x)))).join("\n"));
await browser.close(); process.exit(0);
