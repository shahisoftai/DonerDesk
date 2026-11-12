import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bnd7");
await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("Custom map boundaries"); console.log(t.slice(i, i+450));
await browser.close(); process.exit(0);
