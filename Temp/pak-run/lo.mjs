import { attach } from "./lib.mjs";
const { page, browser } = await attach("lo");
await page.getByRole("button",{name:/^1\. /}).first().click(); await page.waitForTimeout(1000);
await page.getByText(/^Left out/).first().click(); await page.waitForTimeout(1000);
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).split("Your documents")[1]?.slice(0,1500));
await browser.close();
