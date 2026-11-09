import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rmrep");
for (let i = 0; i < 2; i++) { await page.locator("main button", { hasText: /^Remove$/ }).first().click(); await page.waitForTimeout(1200); }
await page.locator("main select").last().selectOption({ label: "Monthly report" });
await page.waitForTimeout(500);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map((b) => b.innerText).filter((t) => /add/i.test(t))));
await browser.close(); process.exit(0);
