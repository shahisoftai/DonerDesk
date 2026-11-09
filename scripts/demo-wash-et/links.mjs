import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("links");
await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
const re = new RegExp(process.argv[3] ?? ".");
console.log((await page.evaluate(() => [...document.querySelectorAll("main a")].map((a) => a.innerText.trim().replace(/\n/g, " ").slice(0, 70) + " -> " + a.getAttribute("href")))).filter((x) => re.test(x)).join("\n"));
await browser.close(); process.exit(0);
