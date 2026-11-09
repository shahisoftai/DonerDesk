import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pl2");
const sels = page.locator("main select").filter({ hasText: "not sure" });
const n = await sels.count(); console.log("rows", n);
for (let i = 0; i < n; i++) await sels.nth(0).selectOption({ label: i < 2 ? "State or province" : "District or locality" });
await page.waitForTimeout(1500);
const c = page.getByRole("button", { name: /^Confirm all/ }); if (await c.count()) { console.log(await c.first().innerText()); await c.first().click(); await page.waitForTimeout(3000); }
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)[\s\S]{0,300}/)?.[0]);
await browser.close(); process.exit(0);
