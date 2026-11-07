import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("results");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button", { name: /Results framework/ }).click(); await page.waitForTimeout(800);
await shot("results");
console.log(page.url());
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).slice(0, 3500));
await browser.close();
