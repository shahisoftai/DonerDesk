import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach();
await page.getByRole("button", { name: "Create logframe items" }).click();
await page.waitForTimeout(8000); console.log(page.url());
console.log((await page.locator("main").innerText()).slice(0,3500));
await browser.close(); process.exit(0);
