import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("off3");
await page.goto(BASE + "/field", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(7000);
const t = (await page.locator("body").innerText()).replace(/\n+/g," / "); console.log(t.slice(0,900));
console.log("btns:", await page.locator("button:visible").allInnerTexts());
await browser.close(); process.exit(0);
