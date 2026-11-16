import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("pl7");
page.setDefaultTimeout(15000);
await page.getByRole("button", { name: "Show the areas inside: K.P." }).click(); await page.waitForTimeout(1500);
for (const nm of ["Upper Dir", "Mardan"]) {
  await page.getByRole("button", { name: nm, exact: true }).first().click(); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Tick this area", exact: true }).click().catch(() => console.log("tick?")); await page.waitForTimeout(2500);
}
const t = await page.locator("main").innerText(); const i = t.indexOf("This project works in"); console.log(t.slice(i, i + 300));
await shot("pl7"); await browser.close();
