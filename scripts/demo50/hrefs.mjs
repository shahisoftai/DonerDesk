import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("hrefs");
await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" }); await page.waitForTimeout(Number(process.argv[3] ?? 3500));
const l = await page.$$eval("main a", (a) => a.map((x) => (x.innerText||"").trim().replace(/\s+/g," ").slice(0,50) + " -> " + x.getAttribute("href")));
console.log([...new Set(l)].join("\n"));
await browser.close(); process.exit(0);
