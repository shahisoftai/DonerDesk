import { open, tabs, shot } from "./wz.mjs";
const { page, browser } = await open("wz7");
await page.getByRole("button", { name: /^3\. / }).click(); await page.waitForTimeout(1500);
const keep = page.getByRole("button", { name: /Keep the \d+ codes/ });
if (await keep.count()) { await keep.click(); await page.waitForTimeout(2500); }
console.log("after keep:", await tabs(page));
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Choose from the library/ }).click(); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Select this group" }).first().click(); await page.waitForTimeout(3000);
console.log("BUTTONS:", (await page.locator("main button:visible").allInnerTexts()).map(s=>s.replace(/\n/g," ")).filter(s=>!/^\d+\. |^[A-Z ]+ /.test(s)).slice(0,25).join(" | "));
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i = t.indexOf("Select the recommended"); console.log(t.slice(Math.max(0,i-300), i+500));
await shot(page, "wz7");
await browser.close(); process.exit(0);
