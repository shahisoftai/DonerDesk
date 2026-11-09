import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("hrefs");
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
console.log((await page.evaluate(() => [...document.querySelectorAll("main a")].map((a) => a.innerText.trim() + " -> " + a.getAttribute("href")).filter((x) => /projects\/40d65f44/.test(x)))).join("\n"));
await browser.close(); process.exit(0);
