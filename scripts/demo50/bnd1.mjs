import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bnd1");
await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i = t.search(/map boundaries|Custom map/i); console.log("CARD:", i>=0 ? t.slice(Math.max(0,i-40), i+900) : "not found");
await browser.close(); process.exit(0);
