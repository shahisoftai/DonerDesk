import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tab");
await page.getByRole("link", { name: process.argv[2], exact: true }).first().click(); await page.waitForTimeout(4000);
console.log(page.url()); await page.screenshot({ path: process.argv[3] });
console.log((await page.locator("main").innerText()).slice(-1800));
await browser.close(); process.exit(0);
