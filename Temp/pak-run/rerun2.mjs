import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("rerun2");
await page.goto("https://donordesk.online/projects/new/wizard?id=89a4d1e9-a837-470d-9f66-a30c21d640dc"); await page.waitForTimeout(3000);
await page.getByRole("button",{name:/^1\. /}).first().click(); await page.waitForTimeout(1500);
await page.getByRole("button",{name:"Read this part again"}).first().click();
await page.waitForTimeout(60000);
await shot("rerun2");
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).split("Your documents")[1]?.slice(0,300));
await browser.close();
