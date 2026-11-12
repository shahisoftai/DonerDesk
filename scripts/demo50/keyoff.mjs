import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("keyoff");
await page.goto(BASE + "/settings/integrations", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Switch off" }).first().click(); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").match(/ZZ TEST support[^/]*\/[^/]*/)?.[0]);
await browser.close(); process.exit(0);
