import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("workplan");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button",{name:/Work plan/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
console.log((await slide.innerText()).replace(/\n+/g," | ").slice(0,2200));
await shot("workplan-start");
await browser.close();
