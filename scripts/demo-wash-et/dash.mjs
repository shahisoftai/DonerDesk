import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dash");
const c = page.locator("main button", { hasText: /^Confirm$/ });
while (await c.count()) { await c.first().click(); await page.waitForTimeout(1200); }
const s = page.getByLabel("Dashboard", { exact: true });
console.log(await s.locator("option").allTextContents());
await browser.close(); process.exit(0);
