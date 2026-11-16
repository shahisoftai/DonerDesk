import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("sa2");
await page.getByText("Sign in securely").click(); await page.waitForTimeout(4000);
console.log(page.url()); console.log((await page.locator("body").innerText()).slice(0,800)); await shot("sa2");
await browser.close();
