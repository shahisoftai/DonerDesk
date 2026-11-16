import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s5");
await page.getByRole("button", { name: /^5\. / }).first().click(); await page.waitForTimeout(1200);
const c = page.getByRole("button", { name: /Confirm all \d+/ }).first(); if (await c.count()) { await c.click(); await page.waitForTimeout(3000); }
await page.getByLabel("Country", { exact: true }).selectOption({ label: "Pakistan" }); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Where the project works"); console.log(t.slice(i, i + 200)); console.log(t.slice(t.indexOf("Pakistan", i + 300)).slice(0, 1800));
await shot("s5"); await browser.close();
