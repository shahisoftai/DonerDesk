import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s5d");
page.setDefaultTimeout(10000);
for (const nm of ["Upper Dir", "Mardan"]) {
  await page.getByLabel("Search areas").fill(nm); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: new RegExp("^" + nm + "\\s*K\\.P\\.$") }).first().click(); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Tick this area", exact: true }).click().catch(() => {}); await page.waitForTimeout(1800);
}
const t = await page.locator("main").innerText(); const i = t.indexOf("Nothing ticked"); console.log(t.slice(t.indexOf("Whole country"), t.indexOf("Whole country") + 500));
console.log(t.slice(t.indexOf("Still to answer")).slice(0, 300));
await shot("s5d"); await browser.close();
