import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("rerun3");
await page.getByRole("button",{name:"Read again",exact:true}).click();
await page.waitForTimeout(75000);
await shot("rerun3");
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).split("Your documents")[1]?.slice(0,300));
await browser.close();
