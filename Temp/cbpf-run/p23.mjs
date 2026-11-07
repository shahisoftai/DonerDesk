import { attach } from "./lib.mjs";
const { page, browser, shot, step, type } = await attach("dataentry");
const slide = page.locator("section[aria-roledescription='slide']");
await step("use all suggestions", async () => { await page.getByRole("button", { name: /Use all \d+ suggestions/ }).click(); await page.waitForTimeout(800); });
await step("review mode full", async () => { await page.getByLabel("How values are checked").selectOption({ label: "Full: every value is handed in, then a reviewer verifies it" }); await page.waitForTimeout(500); });
await step("entry window", async () => { await type("Opens (days before the period ends)", "5", slide); await type("Closes (days after the period ends)", "10", slide); });
console.log((await slide.innerText()).replace(/\n+/g," | ").slice(0,900));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
