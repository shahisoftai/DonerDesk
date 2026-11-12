import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz31");
await page.getByRole("button", { name: /^7\. / }).click(); await page.waitForTimeout(2500);
const sel = page.locator("main select:visible"); const n = await sel.count();
for (let i = 0; i < n; i++) { const opts = await sel.nth(i).locator("option").allInnerTexts(); if (opts.includes("Typed in") && !(await sel.nth(i).inputValue())) { await sel.nth(i).selectOption({ label: "Typed in" }); await page.waitForTimeout(300); } }
await page.waitForTimeout(3000);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,400));
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("Checking values"); console.log(t.slice(i, i+700));
await browser.close(); process.exit(0);
