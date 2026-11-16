import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("sa3");
await page.goto("https://sa.donordesk.online"); await page.waitForTimeout(2000);
await page.getByLabel("Email").fill(process.env.U); await page.getByLabel("Password").fill(process.env.P);
await page.getByRole("button",{name:"Sign in securely"}).click(); await page.waitForTimeout(4000);
console.log((await page.locator("body").innerText()).slice(0,1500)); await shot("sa3");
await browser.close();
