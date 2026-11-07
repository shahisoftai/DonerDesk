import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("launch");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button",{name:/Review and launch/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
const rows = await slide.locator("li, article").filter({ has: page.locator("select") }).all();
for (const r of rows) console.log(JSON.stringify(await r.locator("input").evaluateAll(i=>i.map(x=>x.value))), JSON.stringify(await r.locator("select").evaluateAll(s=>s.map(x=>x.selectedOptions[0]?.textContent))));
await browser.close();
