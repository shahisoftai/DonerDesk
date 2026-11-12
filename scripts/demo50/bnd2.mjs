import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bnd2");
await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i = t.indexOf("Upload boundaries"); console.log(t.slice(Math.max(0,i-700), i+120));
console.log("INPUTS near:", await page.locator("main input[type=file]").evaluateAll(f=>f.map(x=>[x.accept, x.closest("section,div[class*=rounded]")?.innerText.slice(0,60).replace(/\n/g," ")])));
await browser.close(); process.exit(0);
