import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("labels");
if (process.argv[2]) { await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000); }
const out = await page.evaluate(() => [...document.querySelectorAll("label, button, h2, h3")].map((e) => `${e.tagName}:${(e.textContent || "").trim().slice(0, 60)}`).filter((x) => x.length > 5));
console.log(out.join("\n"));
await browser.close(); process.exit(0);
