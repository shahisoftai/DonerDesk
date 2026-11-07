import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("results3");
const nav = page.getByRole("navigation", { name: "Create a project" });
const rail = async () => (await nav.getByRole("button",{name:/Results/}).innerText()).replace(/\n/g," ");
await nav.getByRole("button",{name:/Results framework/}).click(); await page.waitForTimeout(800);
const slide = page.locator("section[aria-roledescription='slide']");
console.log("start:", await rail());
const rows = await slide.locator("li, article").filter({ has: page.locator("select") }).all();
for (const r of rows) console.log(JSON.stringify(await r.locator("input").evaluateAll(i=>i.map(x=>x.value.slice(0,30)))), "badge:", (await r.innerText()).replace(/\s+/g," ").slice(0,60), "| parent:", await r.locator("select").first().evaluate(s=>s.selectedOptions[0]?.textContent?.slice(0,40)));
// Try retyping the goal title (re-save) to see if status changes
const goal = rows[0]; const inp = goal.locator("input").first(); const v = await inp.inputValue();
await inp.fill(v + " "); await inp.press("Tab"); await page.waitForTimeout(700); await inp.fill(v); await inp.press("Tab"); await page.waitForTimeout(900);
console.log("after goal re-save:", await rail());
await shot("results3");
await browser.close();
