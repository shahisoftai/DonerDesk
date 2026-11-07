import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("finance");
await step("use USD reporting currency", async () => { await page.getByRole("button", { name: /Use USD, the currency of the funding/ }).click(); await page.waitForTimeout(800); });
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
