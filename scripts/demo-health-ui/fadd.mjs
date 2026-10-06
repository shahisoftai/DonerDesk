import { attach } from "./lib.mjs"; const { page, browser } = await attach();
await page.getByRole("button", { name: "Add confirmed to report" }).click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).split("Flexible inputs")[1]?.slice(0, 600));
await browser.close(); process.exit(0);
