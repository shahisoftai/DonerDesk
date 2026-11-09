import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rm1");
await page.locator("main button", { hasText: /^Remove$/ }).last().click(); await page.waitForTimeout(1500);
await browser.close(); process.exit(0);
