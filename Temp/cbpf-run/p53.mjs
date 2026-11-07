import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("peek3");
await page.getByRole("navigation", { name: "Create a project" }).getByRole("button",{name:/Results framework/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
for (const r of await slide.locator("li").all()) console.log((await r.innerText()).replace(/\s+/g," ").slice(0,40), "|", await r.locator("input").first().inputValue().catch(()=>"").then(v=>v.slice(0,70)), "| parent:", await r.locator("select").first().evaluate(s=>s.selectedOptions[0]?.textContent?.slice(0,30)).catch(()=>"-"));
await shot("results-run4"); await browser.close();
