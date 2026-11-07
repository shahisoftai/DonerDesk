import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("launch-peek");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Review and launch/}).click(); await page.waitForTimeout(900);
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).slice(0,2500));
await shot("launch-peek");
await browser.close();
