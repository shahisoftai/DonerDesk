import { attach } from "./lib.mjs";
const { page, browser, shot, step, type } = await attach("indicators");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Indicators/}).click(); await page.waitForTimeout(800);
const slide = page.locator("section[aria-roledescription='slide']");
console.log((await slide.innerText()).slice(0,1500));
await shot("indicators-start");
await browser.close();
