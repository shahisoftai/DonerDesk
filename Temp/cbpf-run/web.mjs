import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach("web");
await page.goto(BASE + "/projects/new/wizard?id=55286b1d-ee38-4cf8-9e1e-89cff196e72a"); await page.waitForSelector("h1"); await page.waitForTimeout(1200);
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button", { name: /Places/ }).click(); await page.waitForTimeout(800);
console.log((await page.locator("main").innerText()).match(/Recognised on the web as[^\n]*/g));
await browser.close().catch(() => {});
