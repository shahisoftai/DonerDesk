import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("places");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button",{name:/Places/}).click(); await page.waitForTimeout(800);
const slide = page.locator("section[aria-roledescription='slide']");
console.log((await slide.innerText()).slice(0,1500));
console.log(await slide.getByLabel("Kind of place").first().locator("option").evaluateAll(o=>o.map(x=>x.value+"="+x.textContent)));
await browser.close();
