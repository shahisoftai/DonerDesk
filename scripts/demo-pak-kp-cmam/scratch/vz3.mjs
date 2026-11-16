import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("vz3");
page.setDefaultTimeout(20000);
await page.goto(`${BASE}/visuals`); await page.waitForTimeout(3000);
await page.getByRole("link", { name: "Start from a template" }).first().click().catch(async () => await page.getByRole("button", { name: "Start from a template" }).first().click()); await page.waitForTimeout(3500);
console.log(page.url()); const t = await page.locator("main").innerText(); console.log(t.slice(0, 1800));
await shot("vz3"); await browser.close();
