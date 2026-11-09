import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("wait");
for (let i = 0; i < 70; i++) { const t = await page.locator("main").innerText(); if (!/Sending|being read|Reading|reading your/i.test(t)) break; await page.waitForTimeout(5000); }
await page.screenshot({ path: process.env.SHOT });
const t = await page.locator("main").innerText(); console.log(t.split("Have project documents?")[1]?.slice(0, 1500));
await browser.close(); process.exit(0);
