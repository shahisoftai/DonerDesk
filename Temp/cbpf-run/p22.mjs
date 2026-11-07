import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("dataentry");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button",{name:/Data entry/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
console.log((await slide.innerText()).replace(/\n+/g," | ").slice(0,2200));
await shot("dataentry-start");
await browser.close();
