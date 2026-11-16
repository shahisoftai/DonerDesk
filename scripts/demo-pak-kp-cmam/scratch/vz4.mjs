import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("vz4");
page.setDefaultTimeout(20000);
const card = page.locator("article, section, div").filter({ hasText: /^Nutrition: screening and treatment/ }).last();
await page.getByText("Nutrition: screening and treatment", { exact: true }).first().scrollIntoViewIfNeeded();
const btn = page.getByText("Nutrition: screening and treatment", { exact: true }).first().locator("xpath=ancestor::*[.//button[normalize-space()='Use this template']][1]").getByRole("button", { name: "Use this template" });
await btn.click(); await page.waitForTimeout(3000);
const t = await page.locator("main").innerText(); console.log(page.url()); console.log(t.slice(t.indexOf("Nutrition: screening"), t.indexOf("Nutrition: screening") + 2500));
await shot("vz4"); await browser.close();
