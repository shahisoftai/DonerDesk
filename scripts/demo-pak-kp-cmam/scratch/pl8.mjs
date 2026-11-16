import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("pl8");
page.setDefaultTimeout(15000);
for (const nm of ["Upper Dir", "Mardan"]) {
  const row = page.getByRole("checkbox", { name: nm, exact: true });
  await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(2500);
}
const t = await page.locator("main").innerText(); const i = t.indexOf("This project works in"); console.log(t.slice(i, i + 300));
await shot("pl8"); await browser.close();
