import { open, tabs, shot } from "./wz.mjs";
const { page, browser } = await open("wz5");
await page.getByRole("button", { name: /^3\. / }).click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Choose from the library/ }).click(); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").split("Choose from the library")[1]?.slice(0,1800));
console.log("BUTTONS:", (await page.locator("main button:visible").allInnerTexts()).map(s=>s.replace(/\n/g," ")).filter(s=>!/^\d+\. /.test(s)).slice(0,30).join(" | "));
await shot(page, "wz5");
await browser.close(); process.exit(0);
