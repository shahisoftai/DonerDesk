import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ap"); page.setDefaultTimeout(15000);
await page.getByRole("button", { name: /Approve all clean sections/ }).first().click(); await page.waitForTimeout(3000);
const c = page.getByRole("button", { name: /^(Approve|Confirm|Yes)/ }); if (await c.count()) { await c.last().click(); await page.waitForTimeout(5000); }
console.log((await page.locator("main").innerText()).match(/(Approved|approved)[^\n]*/g)?.slice(0,4));
await browser.close(); process.exit(0);
