import { attach, BASE } from "./lib.mjs";
const { page, browser, shot } = await attach("verify-project");
await page.getByRole("link", { name: "Open the project" }).click(); await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30000 }); await page.waitForTimeout(4000);
console.log(page.url());
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,1500));
await shot("project-created"); await browser.close();
