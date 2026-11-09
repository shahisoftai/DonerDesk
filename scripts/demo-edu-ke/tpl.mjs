import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tpl");
await page.getByRole("button", { name: "Use this template" }).nth(Number(process.argv[2])).click(); await page.waitForTimeout(2500);
await page.screenshot({ path: process.argv[3], fullPage: true }); console.log((await page.locator("main").innerText()).slice(0, 2500));
await browser.close(); process.exit(0);
