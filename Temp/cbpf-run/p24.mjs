import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("reporting");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button",{name:/Reporting/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
console.log((await slide.innerText()).replace(/\n+/g," | ").slice(0,2500));
await shot("reporting-start");
await browser.close();
