import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("navdump");
await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
const links = await page.$$eval("nav a, aside a, header a, header button, nav button", (els) => els.map((e) => (e.innerText||e.getAttribute("aria-label")||"").trim().replace(/\s+/g," ") + " -> " + (e.getAttribute("href")||"btn")).filter((s)=>s.length>5));
console.log([...new Set(links)].join("\n"));
await browser.close(); process.exit(0);
