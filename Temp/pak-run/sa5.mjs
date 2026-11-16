import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("sa5");
await page.getByText("AI & LLM").first().click(); await page.waitForTimeout(3000);
console.log((await page.locator("main").innerText()).slice(0,3000)); await shot("sa5");
await browser.close();
