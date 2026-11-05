import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("head");
await page.locator("main textarea").first().fill("Humanitarian situation - Nigeria north-east, month 1 of 6 (November 2026)"); await page.getByRole("button", { name: "Add the heading" }).click(); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Save", exact: true }).first().click(); await page.waitForTimeout(6000);
await page.screenshot({ path: process.argv[2], fullPage: true }); console.log(page.url());
await browser.close(); process.exit(0);
