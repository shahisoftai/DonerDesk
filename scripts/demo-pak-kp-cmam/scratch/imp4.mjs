import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("imp4");
page.setDefaultTimeout(60000);
const ta = page.locator("textarea").first();
const v = (await ta.inputValue()).replace(/[a-z.]+@pak-cmam-demo\.example/g, "");
await ta.fill(v); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Create planned activities" }).click(); await page.waitForTimeout(10000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Or paste"); console.log(t.slice(i, i + 1200)); console.log(page.url());
await shot("imp4"); await browser.close();
