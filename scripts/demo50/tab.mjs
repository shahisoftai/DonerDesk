import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tab");
await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("tab", { name: process.argv[3] }).first().click(); await page.waitForTimeout(3500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").replace(/^.*Templates \/ Team \/ Settings/,"").slice(0, 1700));
await browser.close(); process.exit(0);
