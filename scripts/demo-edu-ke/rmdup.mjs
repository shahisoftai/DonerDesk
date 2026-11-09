import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rmdup");
const btn = () => page.locator("main button", { hasText: /^Remove$/ });
for (let i = 0; i < 18; i++) { await btn().nth(18).click({ timeout: 8000 }); await page.waitForTimeout(1200); }
console.log("left", await btn().count());
await browser.close(); process.exit(0);
