import { open } from "./wz.mjs";
const { page, browser } = await open("wz38");
await page.getByRole("button", { name: /^10\. / }).click(); await page.waitForTimeout(2500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("The project has been started"); console.log(t.slice(i, i+2500));
console.log(await page.getByRole("link", { name: /Open the project/ }).getAttribute("href").catch(()=>"no link"));
await browser.close(); process.exit(0);
