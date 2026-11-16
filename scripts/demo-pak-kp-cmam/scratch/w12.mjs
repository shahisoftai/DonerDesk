import { attach } from "../lib.mjs";
const { page, browser } = await attach("w12");
await page.waitForTimeout(45000);
await page.reload(); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); console.log("has docs:", t.includes("Your documents")); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 900));
await browser.close();
