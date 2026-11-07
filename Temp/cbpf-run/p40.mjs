import { attach } from "./lib.mjs";
const { page, browser, step, shot } = await attach("indicators-relink");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Indicators/}).click(); await page.waitForTimeout(800);
const slide = page.locator("section[aria-roledescription='slide']");
for (const c of await slide.locator("article").all()) {
  const s = c.getByLabel("Measures"); const cur = await s.evaluate(x=>x.selectedOptions[0]?.textContent);
  console.log("measures now:", cur);
  if (/choose/.test(cur)) for (const o of await s.locator("option").all()) { if (/^Output/.test((await o.innerText()))) { await s.selectOption(await o.getAttribute("value")); await page.waitForTimeout(800); break; } }
}
console.log((await nav.innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
