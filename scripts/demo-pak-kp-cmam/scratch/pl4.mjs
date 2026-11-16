import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("pl4");
page.setDefaultTimeout(30000);
await page.getByRole("button", { name: /^Add these places/ }).click(); await page.waitForTimeout(6000);
const t = await page.locator("main").innerText(); const j = t.indexOf("Add many places from a sheet"); console.log(t.slice(j, j + 900));
await shot("places-added"); await browser.close();
