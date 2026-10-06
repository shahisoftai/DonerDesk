import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach();
await page.getByRole("button", { name: /Create indicator records/ }).click(); await page.waitForTimeout(9000);
console.log((await page.locator("main").innerText()).split("Download template")[1]?.slice(0,3000));
await browser.close(); process.exit(0);
